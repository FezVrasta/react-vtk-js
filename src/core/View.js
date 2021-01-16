import React, {Component} from 'react';
import PropTypes from 'prop-types';

// ----------------------------------------------------------------------------
// Context to pass parent variables to children
// ----------------------------------------------------------------------------

export const ViewContext = React.createContext(null);
export const RepresentationContext = React.createContext(null);
export const DataSetContext = React.createContext(null);
export const FieldsContext = React.createContext(null);
export const DownstreamContext = React.createContext(null);

// ----------------------------------------------------------------------------
// vtk.js Rendering stack
// ----------------------------------------------------------------------------

import vtkOpenGLRenderWindow from 'vtk.js/Sources/Rendering/OpenGL/RenderWindow';
import vtkRenderWindow from 'vtk.js/Sources/Rendering/Core/RenderWindow';
import vtkRenderWindowInteractor from 'vtk.js/Sources/Rendering/Core/RenderWindowInteractor';
import vtkRenderer from 'vtk.js/Sources/Rendering/Core/Renderer';
import vtkInteractorStyleManipulator from 'vtk.js/Sources/Interaction/Style/InteractorStyleManipulator';

// Style modes
import vtkMouseCameraTrackballMultiRotateManipulator from 'vtk.js/Sources/Interaction/Manipulators/MouseCameraTrackballMultiRotateManipulator';
import vtkMouseCameraTrackballPanManipulator from 'vtk.js/Sources/Interaction/Manipulators/MouseCameraTrackballPanManipulator';
import vtkMouseCameraTrackballRollManipulator from 'vtk.js/Sources/Interaction/Manipulators/MouseCameraTrackballRollManipulator';
import vtkMouseCameraTrackballRotateManipulator from 'vtk.js/Sources/Interaction/Manipulators/MouseCameraTrackballRotateManipulator';
import vtkMouseCameraTrackballZoomManipulator from 'vtk.js/Sources/Interaction/Manipulators/MouseCameraTrackballZoomManipulator';
import vtkMouseCameraTrackballZoomToMouseManipulator from 'vtk.js/Sources/Interaction/Manipulators/MouseCameraTrackballZoomToMouseManipulator';
import vtkGestureCameraManipulator from 'vtk.js/Sources/Interaction/Manipulators/GestureCameraManipulator';

// ----------------------------------------------------------------------------
// Helper constants
// ----------------------------------------------------------------------------

const manipulatorFactory = {
  None: null,
  Pan: vtkMouseCameraTrackballPanManipulator,
  Zoom: vtkMouseCameraTrackballZoomManipulator,
  Roll: vtkMouseCameraTrackballRollManipulator,
  Rotate: vtkMouseCameraTrackballRotateManipulator,
  MultiRotate: vtkMouseCameraTrackballMultiRotateManipulator,
  ZoomToMouse: vtkMouseCameraTrackballZoomToMouseManipulator,
};

function assignManipulators(style, settings) {
  style.removeAllMouseManipulators();
  settings.forEach((item) => {
    const klass = manipulatorFactory[item.action];
    if (klass) {
      const { button, shift, control, alt, scrollEnabled, dragEnabled } = item;
      const manipulator = klass.newInstance();
      manipulator.setButton(button);
      manipulator.setShift(!!shift);
      manipulator.setControl(!!control);
      manipulator.setAlt(!!alt);
      if (scrollEnabled !== undefined) {
        manipulator.setScrollEnabled(scrollEnabled);
      }
      if (dragEnabled !== undefined) {
        manipulator.setDragEnabled(dragEnabled);
      }
      style.addMouseManipulator(manipulator);
    }
  });

  // Always add gesture
  style.addGestureManipulator(vtkGestureCameraManipulator.newInstance());
}

// ----------------------------------------------------------------------------
// Default css styles
// ----------------------------------------------------------------------------

const CONTAINER_STYLE = { width: '100%', height: '100%', position: 'relative' };
const RENDERER_STYLE = { position: 'absolute', width: '100%', height: '100%', overflow: 'hidden' };
const HIDDEN_STYLE = { display: 'none' };

/**
 * View is responsible to render vtk.js data.
 * It takes the following set of properties:
 *   - `background`: [0.2, 0.3, 0.4]
 */
export default class View extends Component {
  constructor(props) {
      super(props);
      this.containerRef = React.createRef();

      // Create vtk.js view
      this.renderWindow = vtkRenderWindow.newInstance();
      this.renderer = vtkRenderer.newInstance();
      this.renderWindow.addRenderer(this.renderer);

      this.openglRenderWindow = vtkOpenGLRenderWindow.newInstance();
      this.renderWindow.addView(this.openglRenderWindow);

      this.interactor = vtkRenderWindowInteractor.newInstance();
      this.interactor.setView(this.openglRenderWindow);
      this.interactor.initialize();

      // Interactor style
      this.style = vtkInteractorStyleManipulator.newInstance();
      this.interactor.setInteractorStyle(this.style);

      // Resize handling
      this.resizeObserver = new ResizeObserver(() => this.onResize());

      // expose helper methods
      this.renderView = this.renderWindow.render;
      this.resetCamera = this.resetCamera.bind(this);

      // Internal functions
      this.hasFocus = false;
      this.handleKey = (e) => {
        if (!this.hasFocus) {
          return;
        }
        switch (e.code) {
          case 'KeyR':
            this.resetCamera();
            break;
          default:
            console.log(e.code);
            break;
        }
      };
      this.onEnter = () => {
        this.hasFocus = true;
      }
      this.onLeave = () => {
        this.hasFocus = false;
      }
  }

  render() {
      const { id, children } = this.props;

      return (
          <div
              key={id}
              id={id}
              style={CONTAINER_STYLE}
              onMouseEnter={this.onEnter}
              onMouseLeave={this.onLeave}
          >
              <div
                  style={RENDERER_STYLE}
                  ref={this.containerRef}
              />
              <div>
                  <ViewContext.Provider value={this}>
                      {children}
                  </ViewContext.Provider>
              </div>
          </div>
      );
  }

  onResize() {
      const container = this.containerRef.current;
      if (container) {
          const { width, height } = container.getBoundingClientRect();
          this.openglRenderWindow.setSize(Math.max(width, 10), Math.max(height, 10));
          this.renderWindow.render();
      }
  }

  componentDidMount() {
      const container = this.containerRef.current;
      this.openglRenderWindow.setContainer(container);
      this.interactor.bindEvents(container);
      this.onResize();
      this.resizeObserver.observe(container);
      this.resetCamera();

      this.update(this.props);
      document.addEventListener('keyup', this.handleKey);
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    this.update(this.props, prevProps);
  }

  componentWillUnmount() {
      document.removeEventListener('keyup', this.handleKey);
      // Stop size listening
      this.resizeObserver.disconnect();
      this.resizeObserver = null;

      // Detatch from DOM
      this.interactor.unbindEvents();
      this.openglRenderWindow.setContainer(null);

      // Free memory
      this.renderWindow.removeRenderer(this.renderer);
      this.renderWindow.removeView(this.openglRenderWindow);

      this.interactor.delete();
      this.interactor = null;

      this.renderer.delete();
      this.renderer = null;

      this.renderWindow.delete();
      this.renderWindow = null;

      this.openglRenderWindow.delete();
      this.openglRenderWindow = null;
  }

  update(props, previous) {
    const { background, interactorSettings } = props;
    if (background && (!previous || background !== previous.background)) {
      this.renderer.setBackground(background);
    }
    if (interactorSettings && (!previous || interactorSettings !== previous.interactorSettings)) {
      assignManipulators(this.style, interactorSettings);
    }
  }

  resetCamera() {
    this.renderer.resetCamera();
    this.style.setCenterOfRotation(this.renderer.getActiveCamera().getFocalPoint());
    this.renderWindow.render();
  }
}

View.defaultProps = {
    background: [0.2, 0.3, 0.4],
    interactorSettings: [
      {
        button: 1,
        action: 'Rotate',
      },
      {
        button: 2,
        action: 'Pan',
      },
      {
        button: 3,
        action: 'Zoom',
        scrollEnabled: true,
      },
      {
        button: 1,
        action: 'Pan',
        shift: true,
      },
      {
        button: 1,
        action: 'Zoom',
        alt: true,
      },
      {
        button: 1,
        action: 'ZoomToMouse',
        control: true,
      },
      {
        button: 1,
        action: 'Roll',
        alt: true,
        shift: true,
      },
    ],
};

View.propTypes = {
    /**
     * The ID used to identify this component.
     */
    id: PropTypes.string,

    /**
     * The color of the view background using 3 floating numbers
     * between 0-1 of Red, Green, Blue component.
     */
    background: PropTypes.array,

    /**
     * Configure the interactions
     */
    interactorSettings: PropTypes.array,

    /**
     * List of representation to show
     */
    children: PropTypes.oneOfType([
        PropTypes.arrayOf(PropTypes.node),
        PropTypes.node
    ]),
};
