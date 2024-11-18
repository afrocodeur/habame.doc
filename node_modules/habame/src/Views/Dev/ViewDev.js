/**
 * @param {Object} arg
 * @param {ViewElementFragment} arg.$viewFragment
 * @param {Comment} arg.$viewAnchor
 * @param {Comment} arg.$viewAnchorEnd
 *
 * @class
 */
const ViewDev = function({ $viewFragment, $viewAnchor, $viewAnchorEnd }) {

    const $renderBox = document.createDocumentFragment();


    /**
     * @type {Comment} startAnchor
     * @type {Comment} endAnchor
     */
    this.putInRenderBox = function(startAnchor, endAnchor) {
        let nodeInView = startAnchor.nextSibling;
        while(nodeInView !== endAnchor) {
            if(!nodeInView) {
                break;
            }
            const nodeToStore = nodeInView;
            nodeInView = nodeInView.nextSibling;
            $renderBox.appendChild(nodeToStore);
        }
    };

    /**
     * @param {Comment} anchor
     */
    this.renderRenderBox = function(anchor) {
        this.insertAfter($renderBox, anchor);
    };


    /**
     * @param {string|Array|Object} viewDescription
     */
    this.updateViewDescription = function(viewDescription) {
        this.putInRenderBox($viewAnchor, $viewAnchorEnd);
        $viewFragment.updateViewDescription(viewDescription, $renderBox);
        this.renderRenderBox($viewAnchor);
    };

};

export default ViewDev;