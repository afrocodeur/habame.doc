

/**
 * @param {ViewHtmlElement|ViewComponentElement} viewElement
 *
 * @returns {Object.<string, Function>}
 */
const getSafeNode = function(viewElement) {
    const safeMethods = ['target'];

    const safeNode = {};

    safeMethods.forEach((methodName) => {
        if(!viewElement[methodName]) {
            return;
        }
        safeNode[methodName] = function() {
            return viewElement[methodName].apply(viewElement, Array.from(arguments));
        };
    });

    return { ...safeNode };
};

export default getSafeNode;