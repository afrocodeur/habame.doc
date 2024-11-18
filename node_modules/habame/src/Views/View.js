import ViewElementFragment from "src/Views/ViewElementFragment";
import AbstractView from "src/Views/AbstractView";
import getSafeNode from "../Component/getSafeNode";
import ViewRefCollection from "./ViewRefCollection";
import ViewDev from "./Dev/ViewDev";

/**
 *
 * @param  {string|Array|object} $viewDescription
 * @param {App} $appInstance
 *
 *
 * @class
 * @extends AbstractView
 */
const View = function($viewDescription, $appInstance) {

    const $viewAnchor = document.createComment('');
    const $viewAnchorEnd = document.createComment('');

    /** @type {null|HTMLElement|ParentNode} */
    let $parentNode = null;

    /** @type {{view: View, componentInstance: ?Component, appInstance: App, localState: ?State, getState: ?Function, getStateToUse: function(): State }} */
    const $viewProps = {
        view: this,
        appInstance: $appInstance,
        componentInstance: null,
        localState: null,
        getState: null,
        getStateToUse: function() {
            return this.localState ? this.localState : this.componentInstance.getState();
        }
    };

    AbstractView.call(this, { $viewDescription, $viewProps });

    const $viewFragment = new ViewElementFragment($viewDescription, $viewProps);

    /** @type {Object.<string, (Object.<string, Function>)|ViewRefCollection>} */
    const $references = {};
    const $referenceStore = {};

    /** @type  {?Component} */
    let $componentInstance = null;

    /**
     * @param {HTMLElement|DocumentFragment} parentNode
     * @param {ViewIfStatement} ifStatement
     */
    this.renderProcess = function(parentNode, ifStatement) {
        $parentNode = parentNode;
        parentNode.appendChild($viewAnchor);
        if(ifStatement && ifStatement.isFalse()) {
            return;
        }
        $viewFragment.render(parentNode);
        parentNode.appendChild($viewAnchorEnd);
    };

    /**
     * @param {boolean} full
     */
    this.unmountProcess = function (full) {
        if(full) {
            this.unmountAnchors($viewAnchor.parentNode, $viewAnchor);
        }
        $viewFragment.unmount(full);
        this.setIsUnmounted();
    };

    /**
     * @param {ViewIfStatement} ifStatement
     */
    this.mountProcess = function(ifStatement) {
        this.mountAnchors();
        if(ifStatement && ifStatement.isFalse()) {
            return;
        }
        if($viewFragment.isRendered()) {
            $viewFragment.mount();
        }
        else {
            const fragment = document.createDocumentFragment();
            $viewFragment.render(fragment);
            this.insertAfter(fragment, $viewAnchor);
        }
        this.setIsMounted();
    };

    this.removeProcess = function() {
        $viewFragment.remove();
        this.setIsRemoved();
    };

    /**
     * @param {Component} componentInstance
     */
    this.setComponentInstance = function(componentInstance) {
        $viewProps.componentInstance = componentInstance;
        $viewProps.getState = function(name) {
            if(this.localState) {
                const state = this.localState.get(name);
                if(state) {
                   return state;
                }
            }
            return componentInstance.getStateByName.apply($viewProps.componentInstance, [name]);
        };
        $componentInstance = componentInstance;
        $viewAnchor.textContent = componentInstance.getName() +' Component View Anchor';
        $viewAnchorEnd.textContent = componentInstance.getName() +' Component View End Anchor';
    };

    /**
     * @param {string} name
     * @param {ViewHtmlElement|ViewComponentElement} viewElement
     */
    this.setReference = function(name, viewElement) {
        const refInstance = getSafeNode(viewElement);
        if($referenceStore[name] instanceof ViewRefCollection) {
            $referenceStore[name].push(refInstance);
            if($references[name] === undefined) {
                Object.defineProperty($references, name, {
                    get: function() {
                        return $referenceStore[name];
                    }
                });
            }
            return;
        }
        $referenceStore[name] = refInstance;
        if($references[name] === undefined) {
            Object.defineProperty($references, name, {
                get: function() {
                    return $referenceStore[name]?.target();
                }
            });
        }
    };
    /**
     * @param {string} name
     * @param {boolean} isCollection
     */
    this.cleanReference = function(name, isCollection) {
        if(isCollection === true) {
            if($referenceStore[name] instanceof ViewRefCollection) {
                $referenceStore[name].clean();
                return;
            }
            $referenceStore[name] = new ViewRefCollection();
            return;
        }
        $referenceStore[name] = undefined;
    };

    this.getReferences = function() {
        return $references;
    };

    this.getComponentInstance = function() {
        return $componentInstance;
    };

    this.getAnchor = function() {
        return $viewAnchor;
    };

    ViewDev.apply(this, [{
        $viewFragment,
        $viewAnchor,
        $viewAnchorEnd,
        $callbacks: {
            getParentNode: () => $parentNode
        }
    }]);

};

export default View;