import TextTemplateDescription from "src/Template/TextTemplateDescription";
import AbstractView from "src/Views/AbstractView";
import ViewTextElementDev from "./Dev/ViewTextElementDev";

/**
 * @param {string} $viewDescription
 * @param {{view: View, componentInstance: Component, appInstance: App, localState: ?State, getState: Function, getStateToUse: function(): State }} $viewProps

 * @class
 * @extends AbstractView
 */
const ViewTextElement = function($viewDescription, $viewProps) {

    AbstractView.call(this, { $viewDescription, $viewProps });
    const $viewDescriptionDetails = new TextTemplateDescription($viewDescription, $viewProps);

    /** @type {Text[]} */
    const $htmlTextNodes = [];
    /** @type {{ partValue: string, htmlTextNode: Text }[]} */
    const $textNodes = [];
    let $parentNode = null;

    const build = function() {
        $viewDescriptionDetails.each((viewPart) => {
            let partValue = (!viewPart.hasAState) ? viewPart.value : viewPart.template.value();
            const htmlTextNode = document.createTextNode(partValue);
            $htmlTextNodes.push(htmlTextNode);
            $textNodes.push({ partValue, htmlTextNode });

            if(!viewPart.hasAState) {
                return;
            }
            createConnexion(htmlTextNode, viewPart);
        });
    };

    /**
     * @param {Text} htmlTextNode
     * @param {{template: Template, value: string}} viewPart
     */
    const createConnexion = function(htmlTextNode, viewPart) {
        viewPart.template.onUpdate((updatedValue) => {
            if(updatedValue !== htmlTextNode.textContent) {
                htmlTextNode.textContent = updatedValue;
            }
        });
    };

    /**
     * @param {HTMLElement|DocumentFragment} parentNode
     */
    this.renderProcess = function(parentNode) {
        $parentNode = parentNode;
        if(this.isRendered()) {
            return;
        }
        build();
        this.setParent(parentNode);
        $htmlTextNodes.forEach((htmlTextNode) => {
            parentNode.appendChild(htmlTextNode);
        });
        this.setIsRendered();
    };

    this.unmountProcess = function() {
        this.moveIntoFragment($htmlTextNodes);
        this.setIsUnmounted();
    };

    this.mountProcess = function() {
        this.moveIntoParent();
        this.setIsMounted();
    };
    this.removeProcess = function() {
        $htmlTextNodes.forEach((node) => node.remove());
        this.setIsRemoved();
    };

    ViewTextElementDev.apply(this, [{
        $viewDescription,
        $viewDescriptionDetails,
        $htmlTextNodes,
        $textNodes,
        callbacks: {
            createConnexion,
            getParentNode: () => $parentNode
        }
    }]);
};

export default ViewTextElement;