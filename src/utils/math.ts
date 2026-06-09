export class MathUtils {
  /**
   * Ray-casting algorithm to determine if a point is inside a polygon.
   * @param point [x, y] coordinates of the point
   * @param polygon Array of [x, y] coordinates forming the polygon
   * @returns true if the point is inside the polygon
   */
  static isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
    const [x, y] = point;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i]![0], yi = polygon[i]![1];
      const xj = polygon[j]![0], yj = polygon[j]![1];

      const intersect = ((yi > y) !== (yj > y)) &&
          (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }

    return inside;
  }

  /**
   * Calculate the distance from a point to a line segment.
   * @param p Point coordinates
   * @param v Start coordinates of the segment
   * @param w End coordinates of the segment
   * @returns The exact distance from the point to the segment
   */
  static distanceToLineSegment(p: [number, number], v: [number, number], w: [number, number]): number {
    const l2 = Math.pow(w[0] - v[0], 2) + Math.pow(w[1] - v[1], 2);
    if (l2 === 0) return Math.sqrt(Math.pow(p[0] - v[0], 2) + Math.pow(p[1] - v[1], 2));
    
    let t = ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) / l2;
    t = Math.max(0, Math.min(1, t));
    
    const projX = v[0] + t * (w[0] - v[0]);
    const projY = v[1] + t * (w[1] - v[1]);
    
    return Math.sqrt(Math.pow(p[0] - projX, 2) + Math.pow(p[1] - projY, 2));
  }

  /**
   * Ramer-Douglas-Peucker algorithm for polygon simplification.
   * @param points Array of [x, y] coordinates
   * @param epsilon Tolerance for simplification
   * @returns Simplified array of [x, y] coordinates
   */
  static simplifyPolygon(points: [number, number][], epsilon: number): [number, number][] {
    if (points.length < 3) return points;

    // Find the point with the maximum distance
    let dmax = 0;
    let index = 0;
    const end = points.length - 1;

    for (let i = 1; i < end; i++) {
      const d = this.perpendicularDistance(points[i]!, points[0]!, points[end]!);
      if (d > dmax) {
        index = i;
        dmax = d;
      }
    }

    // If max distance is greater than epsilon, recursively simplify
    if (dmax > epsilon) {
      const recResults1 = this.simplifyPolygon(points.slice(0, index + 1), epsilon);
      const recResults2 = this.simplifyPolygon(points.slice(index, end + 1), epsilon);

      // Build the result list
      return recResults1.slice(0, recResults1.length - 1).concat(recResults2);
    } else {
      return [points[0]!, points[end]!];
    }
  }

  private static perpendicularDistance(p: [number, number], p1: [number, number], p2: [number, number]): number {
    const x = p[0], y = p[1];
    const x1 = p1[0], y1 = p1[1];
    const x2 = p2[0], y2 = p2[1];

    const numerator = Math.abs((x2 - x1) * (y1 - y) - (x1 - x) * (y2 - y1));
    const denominator = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

    if (denominator === 0) {
      return Math.sqrt(Math.pow(x - x1, 2) + Math.pow(y - y1, 2));
    }

    return numerator / denominator;
  }
}
