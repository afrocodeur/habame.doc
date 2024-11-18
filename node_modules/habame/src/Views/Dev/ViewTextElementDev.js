

/**
 * @param {Object} arg
 * @param {string} arg.$viewDescription
 * @param {TextTemplateDescription} arg.$viewDescriptionDetails
 * @param {Text[]} arg.$htmlTextNodes
 * @param {{ partValue: string, htmlTextNode: Text }[]} arg.$textNodes
 * @param {{createConnexion: Function, getParentNode: Function}} arg.callbacks
 *
 * @class
 */
const ViewTextElementDev = function({ $viewDescription, $viewDescriptionDetails, $htmlTextNodes, $textNodes, callbacks }) {

    const { createConnexion, getParentNode } = callbacks;

    const unmountNodes = function() {
        $htmlTextNodes.forEach((node) => {
            node.remove();
        });
        $htmlTextNodes.splice(0);
    };

    const updateRender = () => {
        const parentNode = getParentNode();
        $htmlTextNodes.forEach((htmlTextNode) => {
            parentNode.appendChild(htmlTextNode);
        });
    };

    const build = function() {
        unmountNodes();
        let tempExistingTextNodes = [...$textNodes];
        $viewDescriptionDetails.each((viewPart) => {
            let partValue = (!viewPart.hasAState) ? viewPart.value : viewPart.template.value();

            const existingNode = tempExistingTextNodes.find((item) => item.partValue === partValue);


            const htmlTextNode = existingNode ? existingNode.htmlTextNode : document.createTextNode(partValue);
            $htmlTextNodes.push(htmlTextNode);
            if(!existingNode) {
                $textNodes.push({ partValue, htmlTextNode });
            }
            else {
                tempExistingTextNodes = tempExistingTextNodes.filter((item) => item === existingNode);
            }

            if(existingNode || !viewPart.hasAState) {
                return;
            }
            createConnexion(htmlTextNode, viewPart);
        });

        updateRender();
    };


    /**
     * @param {string} newDescription
     */
    this.updateViewDescription = function(newDescription) {
        if(newDescription === $viewDescription) {
            return;
        }
        $viewDescriptionDetails.refresh(newDescription);
        build();
    };

};

export default ViewTextElementDev;