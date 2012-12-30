/*****************************************************************************\
|                                                                             |
|  AXEL 'condition' binding                                                   |
|                                                                             |
|  Implements data-avoid-{variable} to disable fields on given data values    |
|  Applies to AXEL 'input' plugin                                             |
|                                                                             |
|*****************************************************************************|
|  Prerequisites: jQuery, AXEL, AXEL-FORMS                                    |
|                                                                             |
\*****************************************************************************/
(function ($axel) {

  var _Regexp = {

    onInstall : function ( host ) {
      this.re = new RegExp(this.getParam('regexp') || '');
      this.editor = $axel(host);
      host.bind('axel-update', $.proxy(this.checkRegexp, this));
      $axel.binding.setValidation(this.editor.get(0), $.proxy(this.checkRegexp, this));
    },

    methods : {

      checkRegexp : function  () {
        var valid = this.re.test(this.editor.text());
        return this.toggleError(valid, this.editor.get(0).getHandle(true));
      }
    }
  };

  $axel.binding.register('regexp',
    { error : true  }, // options
    { 'regexp' : $axel.binding.REQUIRED }, // parameters
    _Regexp
  );

}($axel));



