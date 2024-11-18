import ViewTextElement from "src/Views/ViewTextElement";
import ViewComponentElement from "src/Views/ViewComponentElement";
import ViewHtmlElement from "src/Views/ViewHtmlElement";
import ViewLoopFragment from "src/Views/ViewLoopFragment";
import AbstractView from "src/Views/AbstractView";
import ViewElementFragmentDev from "./Dev/ViewElementFragmentDev";

/**
 *
 * @param {string|Array|Object} $viewDescription
 * @param {{view: View, componentInstance: Component, appInstance: App, localState: ?State, getState: Function, getStateToUse: function(): State }} $viewProps
 *
 * @class
 * @extends AbstractView
 */
const ViewElementFragment = function($viewDescription, $viewProps) {

    AbstractView.call(this, { $viewDescription, $viewProps, $isFragment: true });

    /**
     * @type {(ViewTextElement | ViewLoopFragment | ViewElementFragment | ViewComponentElement | ViewHtmlElement)[]}
     */
    const $fragmentElements = [];
    let $nodeToReference = null;
    let $parentNode = null;


    /**
     * @param {string|Array|Object} element
     * @param {string[]} ifStatements
     * @returns {ViewElementFragment}
     */
    const handleViewDescriptionElement = function(element, ifStatements) {
        if(typeof element === 'string') {
            const node = new ViewElementFragment(element, $viewProps);
            $fragmentElements.push(node);
            return node;
        }

        const viewDescriptionItem = { ...element };
        if(element.if) {
            ifStatements.push(element.if);
        }
        else if(element.else === '') {
            if (ifStatements.length === 0) {
                throw new Error('Else without If');
            }
            viewDescriptionItem.if = transformElseIf(ifStatements);
        }
        else if(element.elseif) {
            if(ifStatements.length === 0) {
                throw new Error('ElseIf without If');
            }
            viewDescriptionItem.if = transformElseIf(ifStatements, element.elseif);
            ifStatements.push(element.elseif);
        }
        else {
            ifStatements.splice(0);
        }
        const node = new ViewElementFragment(viewDescriptionItem, $viewProps);
        $fragmentElements.push(node);
        return node;
    };

    /**
     * @param {(string|Array|Object)[]} viewDescription
     */
    const buildFromArray = function(viewDescription) {
        const ifStatements = [];
        for(const element of viewDescription) {
            handleViewDescriptionElement(element, ifStatements);
        }
    };

    /**
     * @param {string|Array|Object} viewDescription
     */
    const buildViewDescription = function(viewDescription) {
        if(!viewDescription) {
            return;
        }
        if(typeof  viewDescription === 'string') {
            const node = new ViewTextElement(viewDescription, $viewProps);
            $fragmentElements.push(node);
            return;
        }
        if(typeof viewDescription !== 'object') {
            return;
        }
        if(viewDescription.repeat) {
            const node = new ViewLoopFragment(viewDescription, $viewProps);
            $fragmentElements.push(node);
            return;
        }
        if(Array.isArray(viewDescription)) {
            buildFromArray(viewDescription);
            return;
        }
        if(viewDescription.component) {
            const node = new ViewComponentElement(viewDescription, $viewProps);
            $fragmentElements.push(node);
            if(viewDescription.ref) {
                $viewProps.view.setReference(viewDescription.ref, node);
                $nodeToReference = node;
            }
            return;
        }
        const node = new ViewHtmlElement(viewDescription, $viewProps);
        $fragmentElements.push(node);
        if(viewDescription.ref) {
            $viewProps.view.setReference(viewDescription.ref, node);
            $nodeToReference = node;
        }
    };

    this.build = function() {
        if(!$viewProps.componentInstance) {
            return;
        }
        buildViewDescription($viewDescription);
    };

    this.restoreRef = function() {
        if(!$nodeToReference || !$viewDescription.ref) {
            return;
        }
        $viewProps.view.setReference($viewDescription.ref, $nodeToReference);
    };

    /**
     * @param {HTMLElement|DocumentFragment} parentNode
     */
    this.renderProcess = function(parentNode) {
        $parentNode = parentNode;
        this.build();
        for(const fragmentElement of $fragmentElements) {
            fragmentElement.render(parentNode);
        }
    };

    /**
     * @param {boolean} full
     */
    this.unmountProcess = function(full) {
        for(const fragmentElement of $fragmentElements) {
            fragmentElement.unmount(full);
        }
        this.setIsUnmounted();
    };

    /**
     * @param {ViewIfStatement} ifStatement
     */
    this.mountProcess = function(ifStatement) {
        if(ifStatement && ifStatement.isFalse()) {
            return;
        }
        for(const fragmentElement of $fragmentElements) {
            fragmentElement.mount();
        }
        this.setIsMounted();
    };
    this.removeProcess = function() {
        for(const fragmentElement of $fragmentElements) {
            fragmentElement.remove();
        }
        this.setIsRemoved();
    };

    ViewElementFragmentDev.apply(this, [{
        $viewDescription,
        $fragmentElements,
        $callbacks: {
            handleViewDescriptionElement,
            buildViewDescription,
            getParentNode: () => $parentNode
        },
    }]);

};

/**
 * @param {string} statementTemplate
 * @returns {string}
 */
const cleanConditionStatement = function(statementTemplate) {
    if(/^\(/.test(statementTemplate) && /\)$/.test(statementTemplate)) {
        return statementTemplate;
    }

    return '(' + statementTemplate.trim() + ')';
};

/**
 * @param {string[]} previousConditions
 * @param {?string} currentIf
 *
 * @returns {string}
 */
const transformElseIf = function(previousConditions, currentIf = null) {
    const notStatementsCleaned = previousConditions.map(cleanConditionStatement);
    const notStatement = '!(' + notStatementsCleaned.join('||') + ')';

    if(!currentIf) {
        return notStatement;
    }

    return notStatement +' && (' + cleanConditionStatement(currentIf) + ')';
};

export default ViewElementFragment;