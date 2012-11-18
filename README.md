AssetManager
============

Handling binary assets like images, audio files or movies in large applications can be annoying.

BAM simplifies the loading process, as it wrapps the assets and returns a simple interface to
access the data.

Features:

- supported media types: images, audio, movie
- allows client side storage


API
===

- constructor( [ assets ], [ storage setting ] )

- set
- unset
- get
- clear
- on
	=> load
	=> progres
	=> error

ToDo
====

- text support
- archiv support (reading)
- implement indexedDB support
- extend browser feature detection


Browser Support
===============

- Firefox 15+
- Chrome 14+
- Internext Explorer 10

