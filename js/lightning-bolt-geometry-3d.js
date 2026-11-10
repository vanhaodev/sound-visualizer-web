// 3D bolt shapes: midpoint displacement with forks that thin and fork again (up to two levels).
// Every path knows its parent and where along it it starts, so a bolt can grow from its root outwards.
// R: { range(a, b), chance(p) } random helpers.

const SEG = 1.5; // target segment length in world units

// Random offset of length in [-off, off], perpendicular to dir
function perpOffset(R, dir, off) {
    const v = new THREE.Vector3(R.range(-1, 1), R.range(-1, 1), R.range(-1, 1));
    v.addScaledVector(dir, -v.dot(dir));
    if (v.lengthSq() < 1e-6) v.set(dir.y, -dir.x, 0);
    return v.setLength(R.range(-off, off));
}

/**
 * A bolt from a to b (THREE.Vector3). Returns a flat list of paths:
 * { pts: [Vector3...], w (1 = trunk, thinner for forks), parent (path or null), attach (0-1 along the parent), grow: 0 }
 */
export function zigzag3D(R, a, b, jag = 0.3, forks = 0.5, w = 1, depth = 0, parent = null, attach = 0, out = []) {
    const L = a.distanceTo(b);
    const dir = b.clone().sub(a).normalize();
    let pts = [a.clone(), b.clone()], off = L * jag;
    while (pts.length < 2 + L / SEG) {
        const next = [pts[0]];
        for (let i = 0; i < pts.length - 1; i++) {
            next.push(pts[i].clone().lerp(pts[i + 1], 0.5).add(perpOffset(R, dir, off)), pts[i + 1]);
        }
        pts = next;
        off *= 0.52;
    }
    const path = { pts, w, parent, attach, grow: 0 };
    out.push(path);

    if (depth < 2) {
        for (let i = 2; i < pts.length - 3; i++) {
            if (!R.chance(forks / (1 + depth) / Math.max(4, pts.length / 6))) continue;
            const fdir = pts[Math.min(pts.length - 1, i + 3)].clone().sub(pts[i]).normalize();
            fdir.add(perpOffset(R, fdir, 1).setLength(Math.tan(R.range(0.35, 0.9)))).normalize();
            const len = (L - (i / pts.length) * L) * R.range(0.25, 0.55);
            zigzag3D(R, pts[i], pts[i].clone().addScaledVector(fdir, len), jag * 1.1, forks, w * 0.55, depth + 1, path, i / (pts.length - 1), out);
        }
    }
    return out;
}

/** A single new branch off a random point of `trunk`, angled away from it, already attached (trunk is grown). */
export function sproutBranch3D(R, trunk) {
    const pts = trunk.pts;
    const i = Math.floor(R.range(pts.length * 0.15, pts.length * 0.9));
    const dir = pts[Math.min(pts.length - 1, i + 2)].clone().sub(pts[i]).normalize();
    dir.add(perpOffset(R, dir, 1).setLength(Math.tan(R.range(0.4, 1.1)))).normalize();
    const len = pts[0].distanceTo(pts[pts.length - 1]) * R.range(0.3, 0.6); // relative to the trunk's span
    return zigzag3D(R, pts[i], pts[i].clone().addScaledVector(dir, len), 0.35, 0.5, 0.55, 1, trunk, i / (pts.length - 1));
}
