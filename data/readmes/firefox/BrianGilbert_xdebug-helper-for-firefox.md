XDebug Helper for Firefox
=========================

Debugging, profiling and tracing PHP code with [Xdebug](http://xdebug.org/) is very powerful, but enabling
Xdebug with cookies or adding POST/GET variables is way too hard. This extension will help you to enable/disable
debugging, profiling and tracing of your PHP-code easily.

It is based on the Chrome extension https://github.com/mac-cain13/xdebug-helper-for-chrome/ with the edits to
remove unsupported webextensions API calls.

Hotkeys
-------
Ctrl+Shift+X (Cmd+Shift+X on Mac) opens the popup.
Alt+Shift+X toggles the debugging state.

How to install this extension?
------------------------------
**Stable version:** Go to the [Firefox Addon](https://addons.mozilla.org/en-GB/firefox/addon/xdebug-helper-for-firefox/)
and click "Add to Firefox".

**Development version:** [Download the source from GitHub](https://github.com/BrianGilbert/xdebug-helper-for-firefox/archive/master.zip)
and [load the extension into Firefox](https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Temporary_Installation_in_Firefox)
yourself!

Pitfalls
--------
**Xdebug Icon not showing up in Address bar.**

You might need to either allow the extension to run in private mode or enable your browser history.
Disabling the browser history internally turns on the private-mode and disables all plugins that aren't allowed for private mode.

@see [this comment](https://github.com/BrianGilbert/xdebug-helper-for-firefox/issues/33#issuecomment-1168994059) and [that comment](https://bugzilla.mozilla.org/show_bug.cgi?id=1266409#c2)


How do I contribute?
--------------------
A: [Submit issues and ideas](https://github.com/BrianGilbert/xdebug-helper-for-firefox/issues)

B: [Submit a pull request](https://help.github.com/articles/using-pull-requests)

1. Fork this repo and create a branch
2. Commit and push your changes to your branch
3. When you're happy send us a pull request!

_**Pro-tip:** Make sure to build upon the latest version of the code and keep pull request as small as possible. This makes your pull request easy to merge._

License
-------
The code of this project is licensed under the [MIT license](https://raw.github.com/BrianGilbert/xdebug-helper-for-firefox/master/source/License)
so you can use it in nearly every project you want to, commercial and non-commercial.

Special thanks
--------------
* [Mathijs Kadijk](http://mathijskadijk.nl/) for creating [Xdebug helper](https://chrome.google.com/webstore/detail/eadndfjplgieldjbigjakmdgkmoaaaoc) for Chrome
* [remailednet](http://blog.remailed.net) for creating the original [XDebug Enabler](https://chrome.google.com/webstore/detail/eippbhbeglgcphcjmpjcjinjamabeoln) for Chrome
* [Guilherme Pim](https://github.com/pimguilherme) for contributing a Manifest v2 version
* [All contributors](https://github.com/wrep/xdebug-helper-for-chrome/graphs/contributors) for taking the time to create a pull request
