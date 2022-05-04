import React, { Component } from 'react';
import PropTypes from 'prop-types';

import vtkRenderWindow from '@kitware/vtk.js/Rendering/Core/RenderWindow';
import vtkRenderWindowInteractor from '@kitware/vtk.js/Rendering/Core/RenderWindowInteractor';
import vtkOpenGLRenderWindow from '@kitware/vtk.js/Rendering/OpenGL/RenderWindow';

// ----------------------------------------------------------------------------
// Context to pass parent variables to children
// ----------------------------------------------------------------------------

export const MultiViewRootContext = React.createContext(null);

export function removeKeys(props, propNames) {
  const cleanedProps = { ...props };
  propNames.forEach((name) => {
    delete cleanedProps[name];
  });
  return cleanedProps;
}

// ----------------------------------------------------------------------------
// Helper constants
// ----------------------------------------------------------------------------

const RENDERER_STYLE = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  pointerEvents: 'none',
};

export default class MultiViewRoot extends Component {
  constructor(props) {
    super(props);
    this.containerRef = React.createRef();

    // Create vtk.js view
    this.renderWindow = vtkRenderWindow.newInstance();
    this.interactor = null;

    this.renderWindowView = vtkOpenGLRenderWindow.newInstance();
    this.renderWindow.addView(this.renderWindowView);

    this.resizeObserver = new ResizeObserver((entries) => {
      this.onResize();
    });

    this.interactor = vtkRenderWindowInteractor.newInstance();
    this.interactor.setView(this.renderWindowView);

    this.onResize = this.onResize.bind(this);

    this.initialized = false;
  }

  componentDidMount() {
    // TODO support runtime toggling of this flag?
    if (!this.props.disabled) {
      const container = this.containerRef.current;
      this.renderWindowView.setContainer(container);

      this.interactor.initialize();

      this.resizeObserver.observe(container);
      this.onResize();

      this.initialized = true;

      this.update(this.props);
    }
  }

  componentDidUpdate(prevProps) {
    this.update(this.props, prevProps);
  }

  componentWillUnmount() {
    if (this.initialized) {
      // Stop size listening
      this.resizeObserver.disconnect();

      if (this.interactor.getContainer()) {
        this.interactor.unbindEvents();
      }

      this.renderWindowView.setContainer(null);
    }

    this.renderWindow.removeView(this.renderWindowView);

    this.interactor.delete();
    this.renderWindow.delete();
    this.renderWindowView.delete();

    this.interactor = null;
    this.renderWindow = null;
    this.renderWindowView = null;
  }

  render() {
    const { id, children, style, disabled } = this.props;

    return (
      <div
        key={id}
        id={id}
        style={{ position: 'relative', ...style }}
        {...removeKeys(this.props, Object.keys(propTypes))}
      >
        <div style={RENDERER_STYLE} ref={this.containerRef} />
        <MultiViewRootContext.Provider value={disabled ? null : this}>
          {children}
        </MultiViewRootContext.Provider>
      </div>
    );
  }

  bindInteractorEvents(container) {
    if (this.interactor) {
      if (this.interactor.getContainer()) {
        this.interactor.unbindEvents();
      }
      if (container) {
        this.interactor.bindEvents(container);
      }
    }
  }

  onResize() {
    const container = this.containerRef.current;
    if (container) {
      const devicePixelRatio = window.devicePixelRatio || 1;
      const { width, height } = container.getBoundingClientRect();
      const w = Math.floor(width * devicePixelRatio);
      const h = Math.floor(height * devicePixelRatio);
      this.renderWindowView.setSize(Math.max(w, 10), Math.max(h, 10));
      this.renderWindow.render();
    }
  }

  update(props, previous) {
    const { triggerRender } = props;
    // Allow to trigger method call from property change
    if (previous && triggerRender !== previous.triggerRender) {
      this.renderViewTimeout = setTimeout(this.renderWindow.render, 0);
    }
  }
}

MultiViewRoot.defaultProps = {
  triggerRender: 0,
  disableRoot: false,
};

export const propTypes = {
  /**
   * The ID used to identify this component.
   */
  id: PropTypes.string,

  /**
   * Property use to trigger a render when changing.
   */
  triggerRender: PropTypes.number,

  /**
   * Disables or enables the multi-renderer root.
   */
  disableRoot: PropTypes.bool,

  /**
   * List of representation to show
   */
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]),
};

MultiViewRoot.propTypes = propTypes;
