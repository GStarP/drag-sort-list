/**
 * style
 */
const CLASSNAME_DSL = "dsl";
const CLASSNAME_DRAGGING = "dsl-dragging";

const BASIC_STYLE = `
.${CLASSNAME_DSL} > * {
  position: relative;
  z-index: 0;
}
.${CLASSNAME_DRAGGING} {
  z-index: 1;
  opacity: 0.9;
}
`;

const applyBasicStyle = () => {
  const styleEl = document.createElement("style");
  styleEl.innerHTML = BASIC_STYLE;
  document.head.appendChild(styleEl);
};

/**
 * logic
 */
class DragSortList {
  _listEl = null;
  _measures = null;
  _dragStartPos = null;
  _draggedChild = null;

  _fromIndex = null;
  _toIndex = null;
  _onResort = null;

  constructor(listEl, onResort) {
    this._listEl = listEl;
    const children = this._listEl.children;

    this._onResort = onResort;

    /**
     * bind styles
     */
    applyBasicStyle();
    this._listEl.classList.add(CLASSNAME_DSL);

    /**
     * measure children layouts
     */
    this._measures = this.computeMeasures();

    /**
     * use mouse-event handlers to simulate drag
     */
    // drag start
    const mousedownHandler = (e) => {
      /**
       * @FIX if put in dragstop handler, may execute before transform animation
       * then layout measurement will be wrong
       */
      this._measures = this.computeMeasures();

      this._isDragging = true;
      this._dragStartPos = { x: e.clientX, y: e.clientY };
      this._draggedChild = e.target;
      this._draggedChild.classList.add(CLASSNAME_DRAGGING);

      /**
       * @TODO O(N) cost can be optimized
       */
      this._fromIndex = Array.from(children).indexOf(this._draggedChild);
      this._toIndex = this._fromIndex;

      document.body.addEventListener("mouseup", mouseupHandler, { once: true });
      document.body.addEventListener("mousemove", mousemoveHandler);

      console.debug("drag start", this._fromIndex);
    };
    // drag end
    const mouseupHandler = (e) => {
      this._draggedChild.classList.remove(CLASSNAME_DRAGGING);

      if (this._fromIndex !== this._toIndex) {
        const isUp = this._fromIndex - this._toIndex > 0;
        const step = isUp ? -1 : 1;

        // directly remove un-dragged children's transform
        // because they are all in correct position
        for (
          let i = this._fromIndex + step;
          i !== this._toIndex + step;
          i += step
        ) {
          children.item(i).style.transform = "";
        }

        // change DOM
        this._listEl.insertBefore(
          this._draggedChild,
          isUp
            ? children.item(this._toIndex)
            : children.item(this._toIndex).nextElementSibling
        );
        // with DOM changed, dragged child should keep its floating position
        const transformAfterResort =
          e.clientY -
          this._dragStartPos.y -
          this._measures[this._toIndex].y +
          this._measures[this._fromIndex].y;
        this._draggedChild.style.transform = `translateY(${transformAfterResort}px)`;

        this._onResort &&
          this._onResort({
            from: this._fromIndex,
            to: this._toIndex,
          });
      }

      // no matter resort or not, dragged child should be back to original position
      const draggedChild = this._draggedChild;
      // should execute after DOM.insert, so use micro task
      setTimeout(() => {
        doTransformYAnimation(draggedChild, 0);
      }, 0);

      /**
       * clean up
       */

      this._isDragging = false;
      this._dragStartPos = null;
      this._draggedChild = null;

      this._fromIndex = null;
      this._toIndex = null;

      document.body.removeEventListener("mousemove", mousemoveHandler);
    };
    // drag move
    const mousemoveHandler = (e) => {
      if (this.isDragging()) {
        // dragging child move with mouse
        const dy = e.clientY - this._dragStartPos.y;
        this._draggedChild.style.transform = `translateY(${dy}px)`;

        /**
         * dragging child swap with another child
         */
        {
          // no movement, top drag up, bottom drag down
          const isUp = e.movementY < 0;
          const noSwap =
            e.movementY === 0 ||
            (isUp && this._toIndex === 0) ||
            (!isUp && this._toIndex === this._measures.length - 1);

          if (!noSwap) {
            const step = isUp ? -1 : 1;
            const nextToIndex = this._toIndex + step;
            /**
             * @ATTENTION
             * this._fromIndex - this._toIndex < 0, means already swapped down, up is reswap
             * this._fromIndex - this._toIndex > 0, means already swapped up, down is reswap
             */
            const isReswap = (this._fromIndex - this._toIndex) * step > 0;
            const childToSwapIndex = isReswap ? this._toIndex : nextToIndex;

            const originalMeasure = this._measures[this._fromIndex];
            const childToSwapMeasure = this._measures[childToSwapIndex];
            let childToSwapCenter =
              this._measures[childToSwapIndex].y +
              childToSwapMeasure.height / 2;
            // if is reswap, target child has already moved originalMeasure.height
            if (isReswap) {
              childToSwapCenter += originalMeasure.height * step;
            }

            // drag down, bottom pass center => swap
            if (
              !isUp &&
              originalMeasure.y + originalMeasure.height + dy >
                childToSwapCenter
            ) {
              this._toIndex = nextToIndex;
              doTransformYAnimation(
                children.item(childToSwapIndex),
                isReswap ? 0 : -1 * originalMeasure.height
              );
            }
            // drag up, top pass center => swap
            if (isUp && originalMeasure.y + dy < childToSwapCenter) {
              this._toIndex = nextToIndex;
              doTransformYAnimation(
                children.item(childToSwapIndex),
                isReswap ? 0 : originalMeasure.height
              );
            }
          }
        }
      }
    };

    /**
     * add event listeners
     */
    for (let i = 0; i < children.length; i++) {
      const child = children.item(i);
      child.addEventListener("mousedown", mousedownHandler);
    }
  }

  isDragging() {
    return this._dragStartPos && this._draggedChild;
  }

  computeMeasures() {
    const ret = [];
    const children = this._listEl.children;
    for (let i = 0; i < children.length; i++) {
      ret.push(children.item(i).getBoundingClientRect());
    }

    console.debug("measures", ret);

    return ret;
  }
}

function doTransformYAnimation(el, value, callback) {
  el.style.transition = "transform 300ms";
  el.style.transform = `translateY(${value}px)`;
  setTimeout(() => {
    el.style.transition = "";
    callback && callback();
  }, 300);
}
