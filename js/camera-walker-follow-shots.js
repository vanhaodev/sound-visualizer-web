// Mode 2 camera shots: filming a galactic giant (galaxy-walker-model.js).
// Scaling human-size shots up does not read as "big" (everything scales together). What sells size:
// close shots only, at street level - right by her feet, down the street behind and ahead of her, a slow orbit
// around her legs - with wide lenses (she overflows the frame), slow camera moves, and the city (cars, lamps,
// buildings) as a human-scale reference. No far shots: seeing her whole from afar makes her look normal-sized again.
// She stays in place while the stars flow past, so "following" her = shots placed relative to her feet.
// She faces -z; positions are in units of her height H. The director glides between shots (easeInOut lerp).
// Same shot contract as CAMERA_SHOTS: setup(state) once, update(t, state, out) writes out.pos / out.target,
// plus an optional out.fov (degrees, default 75).

const _w = () => window.walker; // { anchor: Vector3 feet position, height }
const side = () => (Math.random() < 0.5 ? -1 : 1);

// out = anchor + (x, y, z) in units of her height
function walkerPoint(v, x, y, z) {
    const w = _w();
    return v.set(w.anchor.x + x * w.height, w.anchor.y + y * w.height, w.anchor.z + z * w.height);
}

// All shots stay at street level and look along the street, so the buildings, the road and the cars are always in
// frame next to her (steep looking-up shots only showed sky).
const WALKER_SHOTS = {
    // Right beside her path at ankle height: her legs swing past, the city behind them
    feetPass: {
        setup: (s) => { s.side = side(); },
        update: (t, s, out) => {
            walkerPoint(out.pos, s.side * 0.35, 0.06, -0.3 + t * 0.015);
            walkerPoint(out.target, 0, 0.25, -0.1);
            out.fov = 70;
        }
    },

    // Street level behind her, looking down the street past her legs: the cars flee ahead of her
    streetBehind: {
        setup: (s) => { s.side = side(); },
        update: (t, s, out) => {
            walkerPoint(out.pos, s.side * 0.3, 0.05, 0.75 - t * 0.005);
            walkerPoint(out.target, s.side * 0.05, 0.22, -1.5);
            out.fov = 72;
        }
    },

    // Street level ahead of her, looking back up the street: she strides toward us behind the fleeing cars' headlights
    streetAhead: {
        setup: (s) => { s.side = side(); },
        update: (t, s, out) => {
            walkerPoint(out.pos, s.side * 0.35, 0.05, -(1.1 - t * 0.01));
            walkerPoint(out.target, 0, 0.32, 0);
            out.fov = 75;
        }
    },

    // Slow low orbit around her legs, looking across the street (skyline in frame)
    slowOrbitLow: {
        setup: (s) => { s.from = (Math.random() - 0.5) * 2; s.dir = side(); },
        update: (t, s, out) => {
            const a = s.from + t * 0.04 * s.dir; // 0 = straight in front
            walkerPoint(out.pos, Math.sin(a) * 0.6, 0.07, -Math.cos(a) * 0.6);
            walkerPoint(out.target, 0, 0.38, 0);
            out.fov = 80;
        }
    }
};
