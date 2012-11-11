(function(){

	var AssetManager = ( function(){

		function AssetManager ( assets, storage ) {

			this.storage = storage || false;

			this.requests = [];
			this.readers = [];

			this.assets = {};

			this.supportBlob = this.detectBlob();
			this.supportIDB = this.detectIDB();

			if ( !assets ) return this;

			this.init ( assets );
		}


		/* ToDo: detect browser feature of XHR.responseType */

		AssetManager.prototype.detectBlob = function(){

			if ( !window.URL ) {

				window.URL = window.webkitURL || window.msURL || window.oURL;
			}

			if ( !window.BlobBuilder ) {

				window.BlobBuilder =	window.BlobBuilder || window.WebKitBlobBuilder ||
										window.MozBlobBuilder || window.MSBlobBuilder ||
										window.OBlobBuilder;
			}

			return true;
		};


		/* ToDo: extend IDB support */

		AssetManager.prototype.detectIDB = function(){

			if ( !window.indexedDB ) {

				if ( window.mozIndexedDB ) {

					window.indexedDB = window.mozIndexedDB;

				} else if ( window.webkitIndexedDB ) {

					window.indexedDB =  window.webkitIndexedDB;

					IDBCursor = webkitIDBCursor;
					IDBDatabaseException = webkitIDBDatabaseException;
					IDBRequest = webkitIDBRequest;
					IDBKeyRange = webkitIDBKeyRange;
					IDBTransaction = webkitIDBTransaction;

				} else {

					throw Error('IndexedDB is currently not supported by your browser.');
				}
			}

			if ( !window.indexedDB.deleteDatabase ) {

				throw Error('IndexedDB is currently not supported by your browser.');
			}

			return true;
		};


		AssetManager.prototype.clear = function() {

			var assets = Object.keys(this.assets);

			for ( var i = 0, l = assets.length; i < l; i++ ) {

				delete localStorage[ assets[i] ];
			}
		};


		AssetManager.prototype.init = function ( assets ) {

			var types = Object.keys( assets ),

				_list = {},

				counter = 0,

				list = [],

				refs = {},

				sources, media, j, k, key, url;

			// supported: image, audio, text, movie
			for ( var i = 0, l = types.length; i < l; i++ ) {

				media = assets[ types[i] ];

				if ( !media.length ) {

					sources = Object.keys( media );

					this[ types[i] ] = {}; // this.image = {}

				} else {

					sources = media;
				}

				for ( j = 0, k = sources.length; j < k; j++ ) {

					_list[ media[ sources[j] ] ] = 0;

					refs[ media[ sources[j] ] ] = { media: types[i], id: sources[j] };

					list[ counter ++] = media[ sources[j] ];
				}
			}

			this.refs = refs;

			this.assets = _list;

			this.length = list.length;

			this.step = 100/this.length;

			this.total = 0;

			for ( i = 0, l = list.length; i<l; i++ ) {

				this.req( list[i] );
			}
		};


		// as used for filereaders
		AssetManager.prototype._getPool = function ( type ) {

			var instance;

			if ( type === XMLHttpRequest && this.requests.length ) {

				instance = this.requests.pop();

			} else if ( type === FileReader && this.readers.length ) {

				instance = this.readers.pop();

			} else {

				instance = new type();
			}

			return instance;
		};


		AssetManager.prototype._setPool = function ( obj ) {

			if ( obj instanceof XMLHttpRequest ) {

				this.requests.push( obj );

			} else if ( obj instanceof FileReader ) {

				this.readers.push( obj );
			}
		};


		/* ToDo: connecting via indexedDB */

		AssetManager.prototype.useStorage = function ( url ) {

			var storage = localStorage[url];

			return storage;
		};



		AssetManager.prototype.req = function ( url ) {

			if ( this.storage && this.useStorage( url ) ) {

				if ( !this.usedStorage ) this.usedStorage = true;

				var data = this.useStorage( url );

				this._loaded( url, data ) ;

			} else {

				var xhr = this._getPool( XMLHttpRequest );

				xhr.open( 'GET', url, true );


				xhr.onload = function ( t ) {

					this._setPool( xhr );

					var response = t.currentTarget.response;

					if ( this.supportBlob ) {

						this.read( url, response );

					} else {

						this.createBlob( url, response );
					}

				}.bind(this);



				xhr.onerror = function ( err ) {

					this._error( url, err.currentTarget.error.code, err );

				}.bind(this);

				xhr.onprogress = function ( e ) {

					this._progress( url, e );

				}.bind(this);


				xhr.responseType = this.supportBlob ? 'blob' : 'arraybuffer';

				xhr.send();
			}
		};



		AssetManager.prototype.createBlob = function ( url, data ) { // convert arraybuffer

			var view = new DataView( data ),

				type = this.getType( url ),

				format = url.substr( url.lastIndexOf('.') +1 ).toLowerCase(),

				blob; // binary

			try {

				blob = new Blob([ view ], { type: type + '/' + format });

			} catch ( e ) {

				blob = ( new BlobBuilder() ).append([ view ]).getBlob( type + '/' + format );
			}

			this.read( url, blob );
		};



		AssetManager.prototype.read = function ( url, blob ) { // read blobs to base64

			var reader = this._getPool( FileReader );


			reader.onload = function ( e ) {

				var result = e.currentTarget.result;

				this._loaded( url, result );

			}.bind(this);


			reader.onerror = function ( err ) {

				this._error( url, err.currentTarget.error.code, err);

			}.bind(this);

			reader.onprogress = function ( e ) {

				this._progress( url, e );

			}.bind(this);


			reader.readAsDataURL( blob );

			// console.log( URL.createObjectURL( blob ) ); // => blob / objectURL for indexedDB
		};


		AssetManager.prototype._loaded = function ( url, data ) {

			refs = this.refs[url];

			this.assets[ url ] = data;

			if ( refs ) this[refs.media][refs.id] = this.assets[ url ];

			if ( this.storage ) localStorage[url] = result;

			if ( ! --this.length ) {

				this._emit('load', this );
			}
		};


		AssetManager.prototype._error = function ( src, code, e ) {

			this._emit('error', { src: src, code: code, e: e });
		};


		AssetManager.prototype._progress = function ( src, e ) {

			var perc = ~~( 0.5 + ( this.step * (~~(( e.loaded / e.total ) * 100 ) ) ) / 100 );

			this.total += perc - this.assets[ src ];

			this.assets[ src ] = perc;

			if ( !this._finished ) {

				if ( this.total >= 100 ) { // clear

					this.total = 100;

					this._finished = true;

					this.requests.length = 0;
					this.readers.length = 0;
				}

				this._emit('progress', { src: src, progress: this.total	});
			}
		};



		AssetManager.prototype.set = function ( options, callback, context ) {

			channels.load.length = 0; // clean

			channels.load.push( [ callback, context ] );


			if ( !options.length ) options = [ options ];

			var asset;

			this.total = 0;

			this._finish = false;

			this.length = options.length;

			this.step = 100/this.length;

			for ( var i = 0, l = options.length; i < l; i++ ) {

				asset = options[i];

				if ( asset.type && asset.id ) {

					this.refs[ asset.src ] = { media: asset.type, id: asset.id };
				}

				this.req( asset.src );
			}
		};


		AssetManager.prototype.unset = function ( type, key ) {

			if ( !key ) {	delete this.assets[type];	}
			else		{	delete this[type][key];		}

			if ( localStorage[key] ) delete localStorage[key];

			// URL.revokeObjectURL( data); // => revoke oblob/bjectURL for indexedDB
		};




		/* retrieve media */
		AssetManager.prototype.get = function ( type, key ) {

			var src = ( !key ) ? this.assets[type] : this[type][key],

				container = {

					image: new Image(),

					audio: new Audio(),

					video: function( src ){

						var vid = document.createElement('video');

						vid.src = src;

						return vid;
					}
				};

			// isn't defined yet
			if ( !src ) return null;

			if ( !key ) type = this.getType( type );


			container = container[type];

			container.src = src;

			return container;
		};



		var channels = {

			load: [],
			error: [],
			progress: []
		};


		AssetManager.prototype.getType = function ( url ) {

			url = url.substr( url.lastIndexOf('.') +1 ).toLowerCase();

			if ( url === 'png' || url === 'jpg' || url === 'jpeg' ||	url === 'gif' || url === 'webp' ) {

				url = 'image';

			} else if ( url === 'wav' || url === 'mp3' || url === 'ogg' || url === 'opus' ) {

				url = 'audio';

			} else if ( url === 'mp4' || url === 'avi' || url === 'webm' ) {

				url = 'movie';

			} else {

				throw Error( url + ' <- is not supported yet !');
			}

			return url;
		};

		AssetManager.prototype._emit = function ( type ) {

			var subscribers = channels[ type ];

			if ( subscribers ) {

				var args = Array.prototype.slice.call( arguments, 1 );

				for ( var i = 0, l = subscribers.length; i < l; i++ ) {

					subscribers[i][0].apply( subscribers[0][1], args || [] );
				}
			}
		};


		AssetManager.prototype.on = function ( type, callback, context ) {

			if ( this.usedStorage ) {

				callback( this );

			} else {

				channels[ type ].push( [ callback, context ] );
			}

		};

		return AssetManager;

	})();


})();
