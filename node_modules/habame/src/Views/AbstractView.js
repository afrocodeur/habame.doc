import ViewIfStatement from "src/Views/ViewIfStatement";
import AbstractViewDev from "./Dev/AbstractViewDev";

/**
 *
 * @param {Object} arg
 * @param {string|Array|Object} arg.$viewDescription
 * @param {{view: View, componentInstance: Component, appInstance: App, localState: ?State, getState: Function, getStateToUse: function(): State }} arg.$viewProps
 * @param {boolean} arg.$isFragment
 *
 * @class
 */
const AbstractView = function({ $viewDescription, $viewProps, $isFragment }) {

    const $viewState = { isRendered: false, isUnmount: false, isRemoved: false };

    /** @type {ViewIfStatement} */
    let $ifStatement = null;

    const $switchContainers =  {
        anchorsFragment: document.createDocumentFragment(),
        anchorParent: null, // the node parent
        selfFragment: document.createDocumentFragment(),
        anchor: null, // the node anchor in the DOM
        parent: null // the node parent
    };

    const switchOnState = () => {
        return $ifStatement.isTrue();
    };

    /**
     * @param {string} ifDescription
     * @returns {?ViewIfStatement}
     */
    const buildIfStatement = (ifDescription)=> {
        if(!ifDescription) {
            return null;
        }
        if($ifStatement) {
            return null;
        }
        $ifStatement = new ViewIfStatement(ifDescription, $viewProps);
        $ifStatement.watch((isTrue) => {
            if($viewProps.localState) {
                (!isTrue) ? $viewProps.localState.switchOff(switchOnState) : $viewProps.localState.switchOn();
            }
            (isTrue) ? this.mount() : this.unmount();
        });
        return $ifStatement;
    };

    /**
     * @param {HTMLElement|DocumentFragment} parentNode
     */
    this.render = function(parentNode) {
        if(!parentNode || this.isRendered()) {
            return;
        }
        if($isFragment !== true) {
            buildIfStatement($viewDescription.if);
        }
        this.beforeRenderProcess ? this.beforeRenderProcess() : null;
        this.renderProcess(parentNode, $ifStatement);
        if($ifStatement && $ifStatement.isFalse()){
            this.setIsUnmounted();
        }else {
            this.setIsMounted();
            this.setIsRendered();
        }
    };

    /**
     * @param {HTMLElement|DocumentFragment|Comment} nodeToInsert
     * @param {HTMLElement|DocumentFragment|Comment} targetNode
     */
    this.insertAfter = function(nodeToInsert, targetNode) {
        const nextElement = targetNode.nextSibling;
        if(!targetNode.parentNode) {
            return;
        }
        if(!nextElement) {
            targetNode.parentNode.appendChild(nodeToInsert);
            return;
        }
        targetNode.parentNode.insertBefore(nodeToInsert, nextElement);
    };

    this.mount = function( ) {
        if(!$viewState.isUnmount) {
            return;
        }
        if(!this.mountProcess) {
            return;
        }
        this.mountProcess($ifStatement);
    };

    /**
     * @param {boolean} full
     */
    this.unmount = function(full = false) {
        if($viewState.isUnmount && full !== true) {
            return;
        }
        if(!this.unmountProcess) {
            return;
        }
        this.unmountProcess(full);
    };

    this.remove = function() {
        if($viewState.isRemoved) {
            return;
        }
        if(!this.removeProcess) {
            return;
        }
        this.removeProcess();
    };

    this.setIsRendered = function() {
        $viewState.isRendered = true;
    };

    this.setIsMounted = function() {
        $viewState.isUnmount = false;
    };

    this.setIsRemoved = function() {
        $viewState.isRemoved = true;
    };

    this.setIsNotRemoved = function() {
        $viewState.isRemoved = false;
    };

    this.setIsUnmounted = function() {
        $viewState.isUnmount = true;
    };

    this.isRendered = function() {
        return $viewState.isRendered;
    };

    this.isRemoved = function() {
        return $viewState.isRemoved;
    };

    /**
     * @param {HTMLElement?} parentNode
     */
    this.setParent = function(parentNode) {
        $switchContainers.parent = parentNode;
    };

    /**
     * @param {HTMLElement|Comment} anchorNode
     */
    this.setAnchor = function(anchorNode) {
        $switchContainers.anchor = anchorNode;
    };

    /**
     * @param {HTMLElement | DocumentFragment} parent
     * @param {HTMLElement | DocumentFragment | Text | Comment | (HTMLElement | DocumentFragment | Text | Comment)[]} node
     */
    this.unmountAnchors = function(parent, node) {
        $switchContainers.anchorParent = parent;
        if(Array.isArray(node)) {
            node.forEach((nodeItem) => {
                $switchContainers.anchorsFragment.appendChild(nodeItem);
            });
            return;
        }
        $switchContainers.anchorsFragment.appendChild(node);
    };
    this.mountAnchors = function() {
        if($switchContainers.anchorParent) {
            $switchContainers.anchorParent.appendChild($switchContainers.anchorsFragment);
        }
        $switchContainers.anchorParent = null;
    };

    /**
     * @param {HTMLElement | DocumentFragment | Text | Comment | (HTMLElement | DocumentFragment | Text | Comment)[]} node
     */
    this.moveIntoFragment = function(node) {
        if(Array.isArray(node)) {
            node.forEach((nodeItem) => {
                $switchContainers.selfFragment.appendChild(nodeItem);
            });
            return;
        }
        $switchContainers.selfFragment.appendChild(node);
    };

    /**
     * @param {boolean} isForceAppend
     */
    this.moveIntoParent = function(isForceAppend = false) {
        if($switchContainers.parent || isForceAppend) {
            $switchContainers.parent.appendChild($switchContainers.selfFragment);
            return;
        }
        if(!$switchContainers.anchor) {
            return;
        }
        this.insertAfter($switchContainers.selfFragment, $switchContainers.anchor);
    };

    /**
     * @returns {DocumentFragment}
     */
    this.unMountedFragment = function() {
        return $switchContainers.selfFragment;
    };

    this.getViewDescription = function() {
        return $viewDescription;
    };

    this.updateViewDescription = () => {};
    this.updateIfControl = () => {};

    AbstractViewDev.apply(this, [{
        $viewDescription,
        $callbacks: {
            getIfStatement: () => $ifStatement,
            buildIfStatement
        }
    }]);

};

export default AbstractView;