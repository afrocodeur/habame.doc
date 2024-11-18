
/**
 * @param {Object} arg
 * @param {TextTemplateDescription} arg.$templateDescription
 *
 * @class
 */
const ViewHtmlElementAttributeDev =  function({ $templateDescription }) {

    this.disconnect = function() {
        this.emitUpdate = () => {};
    };

    this.updateValueSource = function(value) {
        $templateDescription.refresh(value);
        this.emitUpdate();
    };

};

export default ViewHtmlElementAttributeDev;