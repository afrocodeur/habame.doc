import ViewDescriptionCompare from "../../Helpers/ViewDescriptionCompare";
import ViewElementFragment from "../ViewElementFragment";

/**
 * @param {Object} arg
 * @param {string|Array|Object} arg.$viewDescription
 * @param {ViewElementFragment[]} arg.$fragmentElements
 * @param {{handleViewDescriptionElement: Function, getParentNode: Function}} arg.$callbacks
 *
 * @class
 */
const ViewElementFragmentDev = function({ $viewDescription, $fragmentElements, $callbacks }) {

    const { handleViewDescriptionElement, getParentNode, buildViewDescription } = $callbacks;

    const render = function(parentNode) {
        parentNode = parentNode || getParentNode();
        if(!parentNode) {
            return;
        }
        $fragmentElements.forEach((node) => {
            node.render(parentNode);
        });
    };

    /**
     * @param {string|Array|Object} viewDescription
     * @param {DocumentFragment|ParentNode|HTMLElement} parentNode
     */
    this.updateViewDescription = function(viewDescription, parentNode) {
        const isViewDescriptionTypeAreDifferent =
            (typeof $viewDescription !== typeof viewDescription)
            || (typeof $viewDescription === 'object' && Array.isArray($viewDescription) === Array.isArray(viewDescription));

        if(isViewDescriptionTypeAreDifferent) {
            $fragmentElements.forEach((node) => {
                node.remove();
            });
            $fragmentElements.splice(0);
            buildViewDescription(viewDescription);
            render(parentNode);
            return;
        }
        const firstElement = $fragmentElements[0];
        if(typeof viewDescription === 'string') {
            firstElement.updateViewDescription(viewDescription);
            return;
        }
        if(typeof viewDescription !== 'object') {
            return;
        }
        if(Array.isArray(viewDescription)) {
            // Todo: compare two object and extract the différence
            if(!Array.isArray($viewDescription)) {
                $viewDescription = [];
            }
            const differences = ViewDescriptionCompare.array(viewDescription, $viewDescription, $fragmentElements);
            $viewDescription.splice(0);
            $viewDescription.push(...viewDescription);
            const nodesToRemove = [];
            $fragmentElements.forEach((element) => {
                element.unmount(true);
                const isNotRemoved = differences.find((item) => {
                    return item?.node === element;
                });
                if(!isNotRemoved) {
                    element.remove();
                    nodesToRemove.push(element);
                }
            });

            nodesToRemove.forEach((elementToRemove) => {
                const index = $fragmentElements.findIndex((element) => element === elementToRemove);
                $fragmentElements.splice(index, 1);
            });

            let ifStatements = [];
            differences.forEach((item) => {
                if(item?.node && item.node instanceof ViewElementFragment) {
                    item.node.mount();
                    if(item.viewDescription?.if) {
                        ifStatements = [item.viewDescription.if];
                    }
                    else if(item.viewDescription?.elseif) {
                        ifStatements.push(item.viewDescription.elseif);
                    }
                    if(item.viewDescription) {
                        item.node.updateViewDescription(item.viewDescription);
                    }
                    return;
                }
                if(item) {
                    const newNode = handleViewDescriptionElement(item, ifStatements);
                    newNode.render(parentNode || getParentNode());
                }
            });
            return;
        }
        if(!viewDescription) {
            return;
        }
        firstElement.updateViewDescription(viewDescription);
    };

};

export default ViewElementFragmentDev;