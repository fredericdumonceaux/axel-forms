 /* ***** BEGIN LICENSE BLOCK *****
  *
  * Copyright (C) 2012 S. Sire
  *
  * This file contains files from the AXEL-FORMS extension to the Adaptable XML Editing Library (AXEL)
  * Version @VERSION@
  *
  * AXEL-FORMS is licensed by Oppidoc SARL
  *
  * Web site : http://www.oppidoc.fr, https://bitbucket.org/ssire/axel-forms
  *
  * Contributors(s) : S. Sire
  *
  * ***** END LICENSE BLOCK ***** */

/*****************************************************************************\
|                                                                             |
|  AXEL Binding                                                               |
|                                                                             |
|  manages bindings life cycle (registration)                                 |
|  exposed as $axel.binding                                                   |
|                                                                             |
|*****************************************************************************|
|  Prerequisites: jQuery, AXEL                                                |
|                                                                             |
|  Global functions:                                                          |
|    $axel.binding.register                                                   |
|        registers a binding object                                           |
|                                                                             |
|  TODO:                                                                      |
|  - lazy klass creation ?                                                    |
|                                                                             |
\*****************************************************************************/
(function ($axel) {

  var registry = {};

  /////////////////////////////
  // Default binding Mixin  //
  ////////////////////////////
  var _bindingK = {

    getDocument : function () {
      return this._doc;
    },

    getParam : function (name) {
        return this._param[name] || this._defaults[name];
    },

    getVariable : function () {
        return this._variable;
    }
  };

  /////////////////////////////
  // Optional binding Mixin  //
  ////////////////////////////
  var _bindingErrorK = {

    // Extracts optional errScope and forges errSel selector to locate error display
    _installError : function ( host ) {
      // FIXME: we could check first a binding specific data-:binding-error-scope
      this.errScope = host.attr('data-error-scope') || undefined;
      this.errSel = '[data-' + this.getName() + '-error="' + this.getVariable() + '"]';
    },

    // Either hide or show error message depending on valid
    // anchor is the DOM node to used as the starting point in case of a scoped error
    toggleError : function (valid, anchor) {
      var error, scope, doc = this.getDocument();
      if (! this.errScope) { // search error in full document
        error = $('body ' + this.errSel, doc);
      } else if (anchor) { // search error within scope
        scope = $(anchor, doc).closest(this.errScope);
        error = $(this.errSel, scope.get(0));
      }
      if (error) {
        if (valid) {
          error.hide();
        } else {
          error.show();
        }
      }
      return valid;
    }
  };

  function _createBingingKlass ( name, options, klassdefs ) {
    var klass = new Function();
    klass.prototype = (function (name) {
      var _NAME = name;
      return {
       getName : function () { return _NAME; }
      };
    }(name));

    $axel.extend(klass.prototype, _bindingK); // inherits default binding methods

    // inherits optoinal mixin modules
    if (options && options.error) {
      $axel.extend(klass.prototype, _bindingErrorK);
    }

    // copy life cycle methods
    klass.prototype.onInstall = klassdefs.onInstall;

    // copy other methods
    $axel.extend(klass.prototype, klassdefs.methods, false, true);
    return klass;
  }
  
  // FIXME: internationalize validation error messages
  function _validate (fields, errid, doc) {
    var errsel = '#' + errid,
        err = [], // required error
        valid = [];  // validation error
    fields.apply(
      function (field) {
        var label;
        if ((field.getParam('required') === 'true') && (! field.isModified())) {
          label = $(field.getHandle()).parent().children('.label').text();
          err.push(label.substr(0, label.indexOf(':')-1));
          $(field.getHandle()).css('backgroundColor', 'pink');
        } else if (field.isValid && (! field.isValid())) {
          label = $(field.getHandle()).parent().children('.label').text();
          valid.push(label.substr(0, label.indexOf(':')-1));
          $(field.getHandle()).css('backgroundColor', 'yellow');
        } else {
          $(field.getHandle()).css('backgroundColor', '');
        }
      }
    );
    $(errsel, doc).html('');
    if (err.length > 0) {
      $(errsel, doc).append(
        '<p>Vous devez remplir les champs suivants : ' + err.join(', ') + '</p>'
      );
    }
    if (valid.length > 0) {
      $(errsel, doc).append(
        '<p>Vous devez corriger les champs suivants : ' + valid.join(', ') + '</p>'
      );
    }
    return (err.length === 0) && (valid.length === 0);
  }
  
  // Extends a primitive editor instance with an isValid function 
  // that executes a validator function (a validator function is a function 
  // returning true or false - usually associated with a binding)
  // Validator functions are chained if one is already present
  function _addValidator (editor, validator) {
    if (editor) {
      if (typeof editor.isValid === "function") {
        editor.isValid.extend(validator);
      } else {
        editor.isValid = function ( func ) { 
            var _chain = [ func ];
            var _valid = function () {
              var i, res = true;
              for (var i = 0; i < _chain.length; i++) {
                res = res && _chain[i](this); // "this" should be the AXEL primitive editor
              }
              return res;
            }
            _valid.extend = function ( func ) {
              _chain.push(func);
            }
            return _valid;
          } (validator);
      }
    } else {
      xtiger.cross.log('error', 'attempt to set a validator function on an undefined editor');
    }
  }

  // Creates and register a new binding class applying optional mixins
  // and declaring parameters
  function _registerBinding ( name, options, parameters, binding ) {
    var defaults = {}, 
        k = _createBingingKlass(name, options, binding);
    $axel.extend(defaults, parameters); // copy default parameters
    registry[name] = {
      name : name,
      options : options,
      defaults : defaults,
      klass : k // FIXME: lazy ?
    };
  }

  // instantiate one binding on a JQuery wrapped host node in a document
  function _installBinding (spec, host, doc ) {
    var k, binding, defaults, cur, param = {}, ok = true;
    var key = host.attr('data-variable'); // mandatory
    if (key) {
      // parses parameters and cancel creation if required parameters are missing
      defaults = spec.defaults;
      for (k in defaults) {
        if (defaults.hasOwnProperty(k)) {
          cur = host.attr('data-' + k);
          if (cur) {
            param[k] = cur;
          } else if (defaults[k] === $axel.binding.REQUIRED) {
            xtiger.cross.log('error', 'Missing attribute "data-' + k + '" to install "' + spec.name + '" binding');
            ok = false;
            break;
          }
        }
      }
      if (ok) {
        binding = new spec.klass();
        binding._doc = doc;
        binding._variable = key;
        binding._defaults = defaults;
        binding._param = param;
        // mixin specific initializations
        if (spec.options && spec.options.error) {
          binding._installError(host);
        }
        // call life cycle method
        binding.onInstall(host); 
        xtiger.cross.log('debug', 'installed binding "' + spec.name + '"');
        return binding;
      }
    } else {
      xtiger.cross.log('error', 'Missing attribute "data-variable" to install "' + spec.name + '" binding');
    }
  }

  // when sliceStart/sliceEnd is defined installs on a slice
  function _installBindings ( doc, sliceStart, sliceEnd ) {
    var cur = sliceStart || doc,
        sel = sliceStart ? '[data-binding]' : 'body [data-binding]'; // body to avoid head section
    xtiger.cross.log('debug', 'installing bindings ' + (sliceStart ? 'slice mode' :  'document mode'));
    do {
      $(sel, cur).each(
        function(index, n) {
          var i, el = $(n),
              names = el.attr('data-binding').split(' ');
          for (i = 0; i < names.length; i++) {
            if (registry[names[i]]) {
              xtiger.cross.log('debug', 'installing binding "' + names[i] + '"');
              _installBinding(registry[names[i]], el, doc);
            } else {
              xtiger.cross.log('error', 'unregistered binding "' + names[i] + '"');
            }
          }
        }
      );
      cur = sliceStart ? cur.nextSibling : undefined;
    } while (cur && (cur !== sliceEnd));
  }

 $axel.binding = $axel.binding || {};

 // exports functions
 $axel.binding.register = _registerBinding;
 $axel.binding.install = _installBindings;
 $axel.binding.validate = _validate; 
 $axel.binding.setValidation = _addValidator;
 $axel.binding.REQUIRED = 1; // constant to declare required parameters
}($axel));

