import React, { Component } from 'react';
import PropTypes from 'prop-types';

import {
  RepresentationContext,
  DownstreamContext,
  DataSetContext,
} from './View';

import vtkPolyData from 'vtk.js/Common/DataModel/PolyData/index.js';

/**
 * PolyData is exposing a vtkPolyData to a downstream filter
 * It takes the following set of properties:
 *   - points: [x, y, z, x, y, z, ...],
 *   - verts: [cellSize, pointId0, pointId1, ..., cellSize, pointId0, ...]
 *   - lines: [cellSize, pointId0, pointId1, ..., cellSize, pointId0, ...]
 *   - polys: [cellSize, pointId0, pointId1, ..., cellSize, pointId0, ...]
 *   - strips: [cellSize, pointId0, pointId1, ..., cellSize, pointId0, ...]
 * Cell connectivity helper property:
 *   - connectivity: 'manual', // [manual, points, triangles, strips]
 */
export default class PolyData extends Component {
  constructor(props) {
    super(props);

    // Create vtk.js polydata
    this.polydata = vtkPolyData.newInstance();
  }

  render() {
    return (
      <RepresentationContext.Consumer>
        {(representation) => (
          <DownstreamContext.Consumer>
            {(downstream) => {
              this.representation = representation;
              if (!this.downstream) {
                this.downstream = downstream;
              }
              return (
                <DataSetContext.Provider value={this.polydata}>
                  <div key={this.props.id} id={this.props.id}>
                    {this.props.children}
                  </div>
                </DataSetContext.Provider>
              );
            }}
          </DownstreamContext.Consumer>
        )}
      </RepresentationContext.Consumer>
    );
  }

  componentDidMount() {
    this.update(this.props);
    this.downstream.setInputData(this.polydata, this.props.port);
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    this.update(this.props, prevProps);
  }

  componentWillUnmount() {
    this.polydata.delete();
    this.polydata = null;
  }

  update(props, previous) {
    const { connectivity, points, verts, lines, polys, strips } = props;
    let changeDetected = false;
    const cellFrom = points.length > 196608 ? Uint32Array.from : Uint16Array.from;
    if (points && (!previous || points !== previous.points)) {
      this.polydata.getPoints().setData(Float64Array.from(points), 3);
      changeDetected = true;
    }

    if (verts && (!previous || verts !== previous.verts)) {
      this.polydata.getVerts().setData(cellFrom(verts));
      changeDetected = true;
    }

    if (lines && (!previous || lines !== previous.lines)) {
      this.polydata.getLines().setData(cellFrom(lines));
      changeDetected = true;
    }

    if (polys && (!previous || polys !== previous.polys)) {
      this.polydata.getPolys().setData(cellFrom(polys));
      changeDetected = true;
    }

    if (strips && (!previous || strips !== previous.strips)) {
      this.polydata.getStrips().setData(cellFrom(strips));
      changeDetected = true;
    }

    if (
      connectivity &&
      (connectivity || !previous || connectivity !== previous.connectivity)
    ) {
      const nbPoints = points.length / 3;
      switch (connectivity) {
        case 'points':
          {
            const values = new Uint32Array(nbPoints + 1);
            values[0] = nbPoints;
            for (let i = 0; i < nbPoints; i++) {
              values[i + 1] = i;
            }
            this.polydata.getVerts().setData(values);
            changeDetected = true;
          }
          break;
        case 'triangles':
          {
            const values = new Uint32Array(nbPoints + nbPoints / 3);
            let offset = 0;
            for (let i = 0; i < nbPoints; i += 3) {
              values[offset++] = 3;
              values[offset++] = i + 0;
              values[offset++] = i + 1;
              values[offset++] = i + 2;
            }
            this.polydata.getPolys().setData(values);
            changeDetected = true;
          }
          break;
        case 'strips':
          {
            const values = new Uint32Array(nbPoints + 1);
            values[0] = nbPoints;
            for (let i = 0; i < nbPoints; i++) {
              values[i + 1] = i;
            }
            this.polydata.getStrips().setData(values);
            changeDetected = true;
          }
          break;
        default:
        // do nothing for manual or anything else...
      }
    }

    if (changeDetected) {
      this.polydata.modified();

      // Let the representation know that data has changed in case auto
      // rendering configs needs to be triggered with the new data.
      if (this.representation) {
        this.representation.dataChanged();
      }
    }

    // // Force prop update now that the downstream has data
    // if (this.downstream === this.representation.mapper) {
    //   this.representation.update(this.representation.props);
    // }
  }
}

PolyData.defaultProps = {
  port: 0,
  points: [],
  connectivity: 'manual',
};

PolyData.propTypes = {
  /**
   * The ID used to identify this component.
   */
  id: PropTypes.string,

  /**
   * downstream connection port
   */
  port: PropTypes.number,

  /**
   * xyz coordinates
   */
  points: PropTypes.arrayOf(PropTypes.number),

  /**
   * verts cells
   */
  verts: PropTypes.arrayOf(PropTypes.number),

  /**
   * lines cells
   */
  lines: PropTypes.arrayOf(PropTypes.number),

  /**
   * polys cells
   */
  polys: PropTypes.arrayOf(PropTypes.number),

  /**
   * strips cells
   */
  strips: PropTypes.arrayOf(PropTypes.number),

  /**
   * Type of connectivity `manual` or implicit such as `points`, `triangles`, `strips`
   */
  connectivity: PropTypes.string,

  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
  ]),
};
