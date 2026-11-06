var GZDOOMSETTINGS = {
    CLOUDSAVEURL: "",

    // --- Load IWAD directly from one file ---
    WADURL: "https://cdn.jsdelivr.net/gh/arcade-v/gzdoom/doom_2/doom2.wad",

    // --- Load mods directly from one file ---
    MODURLS: [
        "https://cdn.jsdelivr.net/gh/arcade-v/gzdoom/lawn_of_the_dead/lawn_of_the_dead.wad"
    ]
};

window.GZDOOMSETTINGS = GZDOOMSETTINGS;

// Keep Blob URLs alive while GZDoom is running.
window.GZDOOM_MOD_BLOB_URLS = [];

// Reconstruct split PK3 or WAD files.
async function loadPK3FromParts(parts, onProgress, fileName) {
    if (!Array.isArray(parts) || parts.length === 0) {
        throw new Error("No file part URLs were provided.");
    }

    const chunks = [];
    let totalBytes = 0;

    for (let i = 0; i < parts.length; i++) {
        console.log(
            `Downloading ${fileName || "file"}: ` +
            `part ${i + 1}/${parts.length}`
        );

        const response = await fetch(parts[i], {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(
                `Failed to load ${fileName || "file"} part ` +
                `${i + 1}/${parts.length}: ` +
                `${response.status} ${response.statusText}`
            );
        }

        const chunk = await response.arrayBuffer();

        if (chunk.byteLength === 0) {
            throw new Error(
                `${fileName || "File"} part ${i + 1} is empty.`
            );
        }

        chunks.push(chunk);
        totalBytes += chunk.byteLength;

        if (typeof onProgress === "function") {
            onProgress({
                part: i + 1,
                totalParts: parts.length,
                downloadedBytes: totalBytes
            });
        }
    }

    const isWAD = /\.wad$/i.test(fileName || "");

    const blob = new Blob(chunks, {
        type: isWAD
            ? "application/octet-stream"
            : "application/zip"
    });

    // Validate WAD (IWAD/PWAD) or ZIP/PK3 signatures.
    const header = new Uint8Array(
        await blob.slice(0, 4).arrayBuffer()
    );

    const signature = String.fromCharCode(...header);

    const validWAD =
        signature === "IWAD" ||
        signature === "PWAD";

    const validZIP =
        header[0] === 0x50 &&
        header[1] === 0x4B &&
        (
            (header[2] === 0x03 && header[3] === 0x04) ||
            (header[2] === 0x05 && header[3] === 0x06) ||
            (header[2] === 0x07 && header[3] === 0x08)
        );

    if (header.length < 4 || (!validWAD && !validZIP)) {
        throw new Error(
            `${fileName || "Reconstructed file"} has an invalid ` +
            "WAD or ZIP/PK3 signature."
        );
    }

    if (isWAD && !validWAD) {
        throw new Error(
            `${fileName} does not have an IWAD/PWAD signature.`
        );
    }

    if (!isWAD && !validZIP) {
        throw new Error(
            `${fileName || "File"} does not have a valid ZIP signature.`
        );
    }

    const blobURL = URL.createObjectURL(blob);
    window.GZDOOM_MOD_BLOB_URLS.push(blobURL);

    console.log(
        `${fileName || "File"} reconstructed successfully: ` +
        `${(totalBytes / 1024 / 1024).toFixed(2)} MB`
    );

    return blobURL;
}

async function resolveGZDoomMods() {
    const mods = GZDOOMSETTINGS.MODURLS;

    // Legacy configuration compatibility.
    if (typeof mods === "string") {
        return mods;
    }

    if (!Array.isArray(mods)) {
        throw new Error(
            "GZDOOMSETTINGS.MODURLS must be a string or array."
        );
    }

    const resolvedURLs = [];

    for (const mod of mods) {
        if (mod && Array.isArray(mod.parts)) {
            const name = mod.name || "mod";

            console.log(`Loading ${name}...`);

            const url = await loadPK3FromParts(
                mod.parts,
                progress => {
                    console.log(
                        `${name}: part ${progress.part}/` +
                        `${progress.totalParts}, ` +
                        `${(
                            progress.downloadedBytes /
                            1024 / 1024
                        ).toFixed(2)} MB downloaded`
                    );
                },
                name
            );

            resolvedURLs.push(url);
        } else if (typeof mod === "string") {
            // Already-hosted WAD or PK3.
            resolvedURLs.push(mod);
            console.log(`Queued mod: ${mod}`);
        } else {
            throw new Error("Invalid mod configuration.");
        }
    }

    return resolvedURLs.join(",");
}

async function prepareGZDoomSettings() {
    const mods = await resolveGZDoomMods();
    GZDOOMSETTINGS.MODURLS = mods;
    window.GZDOOMSETTINGS = GZDOOMSETTINGS;
    return GZDOOMSETTINGS;
}

window.loadPK3FromParts = loadPK3FromParts;
window.resolveGZDoomMods = resolveGZDoomMods;
window.prepareGZDoomSettings = prepareGZDoomSettings;

function postLoad() {
    if (window.myApp == null) return;

    window.myApp.modReplacementHook = function () {
        // Optional mod replacement logic.
    };

    window.myApp.gzDoomIniHook = function (text) {
        return text;
    };
}

window.postLoad = postLoad;