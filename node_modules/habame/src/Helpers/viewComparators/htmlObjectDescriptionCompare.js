/**
 * @param {string|Array|Object} newDescription
 * @param {string|Array|Object} currentDescription
 * @returns {boolean}
 */
const htmlObjectDescriptionCompare = function(newDescription, currentDescription) {


    const  {content: _, ...newDescriptionWithoutContent } = newDescription;
    const  {content: __, ...viewDescriptionWithoutContent } = currentDescription;

    return JSON.stringify(newDescriptionWithoutContent) !== JSON.stringify(viewDescriptionWithoutContent);
};

export default htmlObjectDescriptionCompare;