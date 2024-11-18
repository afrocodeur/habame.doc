import LoopTemplateDescription from "src/Template/LoopTemplateDescription";
import ViewElementFragment from "src/Views/ViewElementFragment";
import State from "src/State/State";
import Template from "src/Template/Template";
import AbstractView from "src/Views/AbstractView";
import ViewLoopFragmentDev from "./Dev/ViewLoopFragmentDev";

/**
 * @param {Array|Object} $viewDescription
 * @param {{view: View, componentInstance: Component, appInstance: App, localState: ?State, getState: Function, getStateToUse: function(): State }} $viewProps
 *
 * @class
 * @extends AbstractView
 */
const ViewLoopFragment = function($viewDescription, $viewProps) {

    AbstractView.call(this, { $viewDescription, $viewProps, $isFragment: true });

    const $viewAnchor = document.createComment('Loop Anchor Start : ' + $viewDescription.repeat);
    const $viewAnchorEnd = document.createComment('Loop Anchor End : ' + $viewDescription.repeat);
    /** @type {{store: Object.<string, {node: ViewElementFragment, localState: State, data: *}>,current: Array,last: Array }} */
    const $nodeInstancesByKey = {
        store: {},
        current: [],
        last: []
    };
    const $viewDescriptionWithoutRepeat = { ...$viewDescription };
    $viewDescriptionWithoutRepeat.repeat = null;

    const $loopTemplate = new LoopTemplateDescription($viewDescription.repeat, $viewProps);
    /** @type {?AbstractLoopExpressionHandler} */
    let $loopExpressionDescription = null;
    let $itemKeyName = '';
    let $itemValueName = '';
    let keyState = new State({ [$itemKeyName]: '' });
    keyState.parent = $viewProps.getStateToUse();
    const $keyTemplate = new Template('', { ...$viewProps, localState: keyState});

    let $isBuild = false;

    const handleLoopExpression = () => {
        $loopExpressionDescription = $loopTemplate.expressionDescription();
        if(!$loopExpressionDescription) {
            return;
        }
        $itemKeyName = $loopExpressionDescription.getIterableItemKeyName();
        $itemValueName = $loopExpressionDescription.getIterableItemValueName();
        keyState.add($itemKeyName, '');
    };

    const build = () => {
        $isBuild = true;
        this.insertAfter($viewAnchorEnd, $viewAnchor);
        updateIteration();
        $loopTemplate.onUpdate(() => { updateIteration(); });
    };

    /**
     * @param {Object} iterable
     * @param {string|number} index
     */
    const updateIterationItem = function(iterable, index) {
        // TODO : create this own state or update it
        const stateData = { [$itemValueName]: iterable[index] };
        if($itemKeyName) {
            stateData[$itemKeyName] = index;
        }
        const nodeKey = $keyTemplate.value(stateData);
        $nodeInstancesByKey.current.push(nodeKey);

        if($nodeInstancesByKey.store[nodeKey]) {
            const existingNode = $nodeInstancesByKey.store[nodeKey];
            if(existingNode.data !== stateData[$itemValueName]) {
                existingNode.localState.set(stateData);
            }
            existingNode.localState.refreshProps();
            existingNode.node.restoreRef();
            return;
        }

        const localState = new State(stateData);
        localState.parent = $viewProps.getStateToUse();
        const node = new ViewElementFragment($viewDescriptionWithoutRepeat, { ...$viewProps, localState });
        $nodeInstancesByKey.store[nodeKey] = {
            node,
            data: stateData[$itemValueName],
            localState
        };
    };
    const updateIteration = function() {
        const iterable = $loopTemplate.getIterable();
        if($viewDescriptionWithoutRepeat.ref) {
            $viewProps.view.cleanReference($viewDescription.ref, true);
        }

        const iterableIsArray = Array.isArray(iterable);
        $nodeInstancesByKey.last = $nodeInstancesByKey.current;
        $nodeInstancesByKey.current = [];

        if(iterableIsArray) {
            for(let index = 0; index < iterable.length; index++) {
                updateIterationItem(iterable, index);
            }
        }
        else {
            for(const index in iterable) {
                updateIterationItem(iterable, index);
            }
        }

        updateDom();
    };

    const removeUselessElement = function() {
        for (const nodeKey of $nodeInstancesByKey.last) {
            if(!$nodeInstancesByKey.current.includes(nodeKey)) {
                // Think about reusable node
                $nodeInstancesByKey.store[nodeKey].node.remove();
                $nodeInstancesByKey.store[nodeKey] = null;
            }
        }
    };

    const updateDom = function() {
        removeUselessElement();

        // update existing elements or add new elements
        for (const nodeKey of $nodeInstancesByKey.current) {
            if($nodeInstancesByKey.last.includes(nodeKey)) {
                continue;
            }
            const fragment = document.createDocumentFragment();
            const node = $nodeInstancesByKey.store[nodeKey].node;
            if(node.isRendered()) {
                continue;
            }
            node.render(fragment);
            if($viewAnchorEnd.parentNode) {
                $viewAnchorEnd.parentNode.insertBefore(fragment, $viewAnchorEnd);
            }
        }
    };


    /**
     * @param {HTMLElement|DocumentFragment} parentNode
     * @param {ViewIfStatement} ifStatement
     */
    this.renderProcess = function(parentNode, ifStatement) {
        parentNode.appendChild($viewAnchor);
        this.setAnchor($viewAnchor);
        if(ifStatement && ifStatement.isFalse()) {
            return;
        }
        build();
    };

    /**
     * @param {boolean} full
     */
    this.unmountProcess = function(full) {
        this.setParent(null);
        for (const nodeKey of $nodeInstancesByKey.current) {
            $nodeInstancesByKey.store[nodeKey].node.unmount();
        }
        if(full) {
            const nodes = [$viewAnchor];
            let currentStep = $viewAnchor;

            while(currentStep.nextSibling !== $viewAnchorEnd) {
                currentStep = currentStep.nextSibling;
                if(currentStep instanceof Comment) {
                    nodes.push(currentStep);
                }
            }
            nodes.push($viewAnchorEnd);

            this.unmountAnchors($viewAnchor.parentNode, nodes);
        }
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
        if($isBuild) {
            for (const nodeKey of $nodeInstancesByKey.current) {
                $nodeInstancesByKey.store[nodeKey].node.mount();
            }
        }
        else {
            build();
        }
        this.setIsMounted();
    };

    this.removeProcess = function() {
        for (const nodeKey of $nodeInstancesByKey.current) {
            $nodeInstancesByKey.store[nodeKey].node.remove();
        }
        $viewAnchor.remove();
        $viewAnchorEnd.remove();
        this.setIsRemoved();
    };

    ViewLoopFragmentDev.apply(this, [{
        $loopTemplate,
        $keyTemplate,
        $nodeInstancesByKey,
        $viewDescriptionWithoutRepeat,
        $callbacks: {
            handleLoopExpression,
            updateIteration,
            getItemKeyName: () => $itemKeyName
        }
    }]);

    ((() => {
        handleLoopExpression();
        $keyTemplate.refresh($viewDescriptionWithoutRepeat.key || $itemKeyName);
    })());

};

export default ViewLoopFragment;