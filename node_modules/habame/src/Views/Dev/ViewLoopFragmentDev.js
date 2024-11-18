
/**
 * @param {Object} arg
 * @param {LoopTemplateDescription} arg.$loopTemplate
 * @param {Template} arg.$keyTemplate
 * @param {Object} arg.$viewDescriptionWithoutRepeat
 * @param {{store: Object.<string, {node: ViewElementFragment, localState: State}>,current: Array,last: Array }} arg.$nodeInstancesByKey
 * @param {ViewElementFragment} arg.$callbacks
 *
 * @class
 */
const ViewLoopFragmentDev =  function({ $loopTemplate, $keyTemplate, $viewDescriptionWithoutRepeat, $nodeInstancesByKey, $callbacks }) {

    const { handleLoopExpression, getItemKeyName, updateIteration } = $callbacks;

    const updateExistingNodes = function(viewWithoutRepeat) {
        Object.values($nodeInstancesByKey.store).forEach(({ node }) => {
            if(
                (viewWithoutRepeat.name && $viewDescriptionWithoutRepeat.name === viewWithoutRepeat.name)
                ||
                (viewWithoutRepeat.component && $viewDescriptionWithoutRepeat.component === viewWithoutRepeat.component)
            ) {
                node.updateViewDescription(viewWithoutRepeat);
            }
        });
    };

    /**
     * @param {Object.<string, *>} value
     */
    this.updateViewDescription = function(value) {
        const { repeat, ...viewWithoutRepeat } = value;
        $loopTemplate.refresh(repeat);
        handleLoopExpression();
        $keyTemplate.refresh(value.key || getItemKeyName());

        const isNotTheSameNode = viewWithoutRepeat.name && $viewDescriptionWithoutRepeat.name !== viewWithoutRepeat.name;
        const isNotTheSameComponent = viewWithoutRepeat.component && $viewDescriptionWithoutRepeat.component !== viewWithoutRepeat.component;


        if(isNotTheSameNode || isNotTheSameComponent) {
            $nodeInstancesByKey.store = {};
            $nodeInstancesByKey.current = {};
        }
        else {
            updateExistingNodes(viewWithoutRepeat);
        }

        Object.keys($viewDescriptionWithoutRepeat).forEach((property) => {
            $viewDescriptionWithoutRepeat[property] = (viewWithoutRepeat[property] !== undefined ? viewWithoutRepeat[property] : null);
        });

        updateIteration();
    };

};

export default ViewLoopFragmentDev;