// Minimal QR code encoder - no libraries.
//
// Supports what this app needs: byte mode, error correction level L, versions 1-5
// (up to 106 bytes, far more than a short URL). createQrMatrix(text) returns a square
// array of rows, where true means a dark module. Rendering is left to the caller.
//
// Follows the QR Code standard (ISO/IEC 18004). The steps are:
//   1. Encode the text as bits and pad it to the version's data capacity
//   2. Add Reed-Solomon error correction codewords
//   3. Draw the fixed patterns (finders, timing, alignment, format info)
//   4. Place the codewords in the zigzag order, applying a mask
//   5. Try all 8 masks and keep the one that scores best (easiest to scan)

// Level L uses a single error correction block for versions 1-5
const QR_VERSIONS = [
    { version: 1, totalCodewords: 26, ecCodewords: 7 },
    { version: 2, totalCodewords: 44, ecCodewords: 10 },
    { version: 3, totalCodewords: 70, ecCodewords: 15 },
    { version: 4, totalCodewords: 100, ecCodewords: 20 },
    { version: 5, totalCodewords: 134, ecCodewords: 26 }
];

const QR_BYTE_MODE = 0b0100;
const QR_FORMAT_LEVEL_L = 0b01;

function createQrMatrix(text) {
    const bytes = Array.from(new TextEncoder().encode(text));

    // Smallest version whose data capacity fits: 4-bit mode + 8-bit length + the bytes
    const spec = QR_VERSIONS.find(function (v) {
        return 4 + 8 + bytes.length * 8 <= (v.totalCodewords - v.ecCodewords) * 8;
    });
    if (!spec) {
        throw new Error("Text is too long for this QR encoder (max 106 bytes)");
    }

    const codewords = qrBuildCodewords(bytes, spec);

    let best = null;
    for (let mask = 0; mask < 8; mask++) {
        const matrix = qrBuildMatrix(codewords, spec.version, mask);
        const penalty = qrPenaltyScore(matrix);
        if (best === null || penalty < best.penalty) {
            best = { matrix: matrix, penalty: penalty };
        }
    }
    return best.matrix;
}

// ---------- Step 1 and 2: data and error correction codewords ----------

function qrBuildCodewords(bytes, spec) {
    const dataCapacity = spec.totalCodewords - spec.ecCodewords;
    const bits = [];

    function pushBits(value, length) {
        for (let i = length - 1; i >= 0; i--) {
            bits.push((value >>> i) & 1);
        }
    }

    pushBits(QR_BYTE_MODE, 4);
    pushBits(bytes.length, 8);
    bytes.forEach(function (b) {
        pushBits(b, 8);
    });

    // Terminator (up to four 0 bits), then pad to a whole byte
    pushBits(0, Math.min(4, dataCapacity * 8 - bits.length));
    while (bits.length % 8 !== 0) {
        bits.push(0);
    }

    const data = [];
    for (let i = 0; i < bits.length; i += 8) {
        data.push(parseInt(bits.slice(i, i + 8).join(""), 2));
    }

    // Fill the remaining capacity with the standard alternating pad bytes
    for (let pad = 0xEC; data.length < dataCapacity; pad ^= 0xEC ^ 0x11) {
        data.push(pad);
    }

    return data.concat(qrReedSolomon(data, spec.ecCodewords));
}

// Multiplication in GF(2^8) with the QR polynomial x^8 + x^4 + x^3 + x^2 + 1 (0x11D)
function qrGfMultiply(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
        z = (z << 1) ^ ((z >>> 7) * 0x11D);
        z ^= ((y >>> i) & 1) * x;
    }
    return z;
}

// Returns the Reed-Solomon error correction codewords for the data
function qrReedSolomon(data, degree) {
    // Generator polynomial (x - 1)(x - 2)(x - 4)...: coefficients highest power first,
    // with the leading 1 left out
    const generator = new Array(degree).fill(0);
    generator[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
        for (let j = 0; j < degree; j++) {
            generator[j] = qrGfMultiply(generator[j], root);
            if (j + 1 < degree) {
                generator[j] ^= generator[j + 1];
            }
        }
        root = qrGfMultiply(root, 0x02);
    }

    // Polynomial long division; the remainder is the error correction data
    const remainder = new Array(degree).fill(0);
    data.forEach(function (b) {
        const factor = b ^ remainder.shift();
        remainder.push(0);
        generator.forEach(function (coefficient, i) {
            remainder[i] ^= qrGfMultiply(coefficient, factor);
        });
    });
    return remainder;
}

// ---------- Steps 3 and 4: drawing the matrix ----------

function qrBuildMatrix(codewords, version, mask) {
    const size = 17 + version * 4;
    const modules = [];
    const reserved = [];
    for (let y = 0; y < size; y++) {
        modules.push(new Array(size).fill(false));
        reserved.push(new Array(size).fill(false));
    }

    // Draws a fixed-pattern module that data must not overwrite
    function setFixed(x, y, dark) {
        modules[y][x] = dark;
        reserved[y][x] = true;
    }

    // Timing patterns: alternating modules along row 6 and column 6
    for (let i = 0; i < size; i++) {
        setFixed(6, i, i % 2 === 0);
        setFixed(i, 6, i % 2 === 0);
    }

    // Finder patterns (the three big squares) plus their light separators
    [[3, 3], [size - 4, 3], [3, size - 4]].forEach(function (center) {
        for (let dy = -4; dy <= 4; dy++) {
            for (let dx = -4; dx <= 4; dx++) {
                const x = center[0] + dx;
                const y = center[1] + dy;
                if (x >= 0 && y >= 0 && x < size && y < size) {
                    const ring = Math.max(Math.abs(dx), Math.abs(dy));
                    setFixed(x, y, ring !== 2 && ring !== 4);
                }
            }
        }
    });

    // Versions 2-5 have one alignment pattern near the bottom-right corner
    if (version >= 2) {
        const center = size - 7;
        for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
                setFixed(center + dx, center + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
            }
        }
    }

    qrDrawFormatBits(setFixed, size, mask);

    // Place data bits in two-column strips, zigzagging up and down from the right edge
    let bitIndex = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
        if (right === 6) {
            right = 5; // skip the vertical timing pattern
        }
        const upward = ((right + 1) & 2) === 0;
        for (let vert = 0; vert < size; vert++) {
            for (let j = 0; j < 2; j++) {
                const x = right - j;
                const y = upward ? size - 1 - vert : vert;
                if (reserved[y][x]) {
                    continue;
                }
                let dark = false;
                if (bitIndex < codewords.length * 8) {
                    dark = ((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) === 1;
                    bitIndex++;
                }
                modules[y][x] = dark !== qrMaskApplies(mask, x, y);
            }
        }
    }
    return modules;
}

// The 8 standard mask patterns; a masked module has its color flipped
function qrMaskApplies(mask, x, y) {
    switch (mask) {
        case 0: return (x + y) % 2 === 0;
        case 1: return y % 2 === 0;
        case 2: return x % 3 === 0;
        case 3: return (x + y) % 3 === 0;
        case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
        case 5: return (x * y) % 2 + (x * y) % 3 === 0;
        case 6: return ((x * y) % 2 + (x * y) % 3) % 2 === 0;
        default: return ((x + y) % 2 + (x * y) % 3) % 2 === 0;
    }
}

// Format info (error correction level + mask) is stored twice, protected by a BCH code
function qrDrawFormatBits(setFixed, size, mask) {
    const data = (QR_FORMAT_LEVEL_L << 3) | mask;
    let remainder = data;
    for (let i = 0; i < 10; i++) {
        remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
    }
    const bits = ((data << 10) | remainder) ^ 0x5412;

    function bit(i) {
        return ((bits >>> i) & 1) === 1;
    }

    // First copy, around the top-left finder
    for (let i = 0; i <= 5; i++) {
        setFixed(8, i, bit(i));
    }
    setFixed(8, 7, bit(6));
    setFixed(8, 8, bit(7));
    setFixed(7, 8, bit(8));
    for (let i = 9; i < 15; i++) {
        setFixed(14 - i, 8, bit(i));
    }

    // Second copy, split between the top-right and bottom-left finders
    for (let i = 0; i < 8; i++) {
        setFixed(size - 1 - i, 8, bit(i));
    }
    for (let i = 8; i < 15; i++) {
        setFixed(8, size - 15 + i, bit(i));
    }
    setFixed(8, size - 8, true); // the "dark module" that is always set
}

// ---------- Step 5: scoring a mask (lower is easier to scan) ----------

function qrPenaltyScore(modules) {
    const size = modules.length;
    let penalty = 0;

    const lines = [];
    for (let i = 0; i < size; i++) {
        lines.push(modules[i]);
        lines.push(modules.map(function (row) {
            return row[i];
        }));
    }

    lines.forEach(function (line) {
        // Rule 1: runs of 5 or more same-colored modules
        let run = 1;
        for (let i = 1; i <= size; i++) {
            if (i < size && line[i] === line[i - 1]) {
                run++;
            } else {
                if (run >= 5) {
                    penalty += run - 2;
                }
                run = 1;
            }
        }

        // Rule 3: patterns that look like a finder (1:1:3:1:1 next to 4 light modules)
        const text = line.map(function (dark) {
            return dark ? "1" : "0";
        }).join("");
        ["10111010000", "00001011101"].forEach(function (pattern) {
            for (let i = text.indexOf(pattern); i !== -1; i = text.indexOf(pattern, i + 1)) {
                penalty += 40;
            }
        });
    });

    // Rule 2: 2x2 blocks of the same color
    for (let y = 0; y < size - 1; y++) {
        for (let x = 0; x < size - 1; x++) {
            const color = modules[y][x];
            if (color === modules[y][x + 1] && color === modules[y + 1][x] && color === modules[y + 1][x + 1]) {
                penalty += 3;
            }
        }
    }

    // Rule 4: overall balance of dark and light modules
    let dark = 0;
    modules.forEach(function (row) {
        row.forEach(function (module) {
            if (module) {
                dark++;
            }
        });
    });
    const total = size * size;
    penalty += Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10;

    return penalty;
}
