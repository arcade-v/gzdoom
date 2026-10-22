var GZDOOMSETTINGS = {
    CLOUDSAVEURL: "",

    // --- Autoload ---
    WADURL: "https://cdn.jsdelivr.net/gh/gzdoom/doom_2/doom2.wad",

    // PK3 split into sequential binary parts.
    // Add or remove URLs to match your actual files.
    MODURLS: [
        {
            name: "myhouse.pk3",
            parts: [
                "https://cdn.jsdelivr.net/gh/gzdoom/myhouse/myhouse.pk3.part1",
                "https://cdn.jsdelivr.net/gh/gzdoom/myhouse/myhouse.pk3.part2",
                "https://cdn.jsdelivr.net/gh/gzdoom/myhouse/myhouse.pk3.part3",
                "https://cdn.jsdelivr.net/gh/gzdoom/myhouse/myhouse.pk3.part4"
            ]
        }
    ]
};

window.GZDOOMSETTINGS = GZDOOMSETTINGS;

// Keep Blob URLs alive while the game is running.
window.GZDOOM_MOD_BLOB_URLS = [];

async function loadPK3FromParts(parts, onProgress) {
    if (!Array.isArray(parts) || parts.length === 0) {
        throw new Error("No PK3 part URLs were provided.");
    }

    const chunks = [];
    let totalBytes = 0;

    for (let i = 0; i < parts.length; i++) {
        const response = await fetch(parts[i], {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(
                `Failed to load PK3 part ${i + 1}/${parts.length}: ` +
                `${response.status} ${response.statusText}`
            );
        }

        const chunk = await response.arrayBuffer();

        if (chunk.byteLength === 0) {
            throw new Error(`PK3 part ${i + 1} is empty.`);
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

    const blob = new Blob(chunks, {
        type: "application/zip"
    });

    // Basic ZIP/PK3 signature validation.
    const header = new Uint8Array(
        await blob.slice(0, 4).arrayBuffer()
    );

    if (
        header.length < 4 ||
        header[0] !== 0x50 ||
        header[1] !== 0x4B ||
        !(
            (header[2] === 0x03 && header[3] === 0x04) ||
            (header[2] === 0x05 && header[3] === 0x06) ||
            (header[2] === 0x07 && header[3] === 0x08)
        )
    ) {
        throw new Error(
            "The reconstructed file does not have a valid ZIP/PK3 signature."
        );
    }

    const blobURL = URL.createObjectURL(blob);
    window.GZDOOM_MOD_BLOB_URLS.push(blobURL);

    return blobURL;
}
async function resolveGZDoomMods() {
    const mods = GZDOOMSETTINGS.MODURLS;

    // Preserve compatibility with the original string configuration.
    if (typeof mods === "string") {
        return mods;
    }

    if (!Array.isArray(mods)) {
        throw new Error("GZDOOMSETTINGS.MODURLS must be a string or array.");
    }

    const resolvedURLs = [];

    for (const mod of mods) {
        if (!mod || !Array.isArray(mod.parts)) {
            throw new Error("Invalid PK3 mod configuration.");
        }

        console.log(`Loading ${mod.name || "PK3"}...`);

        const url = await loadPK3FromParts(
            mod.parts,
            progress => {
                console.log(
                    `${mod.name || "PK3"}: ` +
                    `part ${progress.part}/${progress.totalParts}, ` +
                    `${(progress.downloadedBytes / 1024 / 1024).toFixed(2)} MB downloaded`
                );
            }
        );

        resolvedURLs.push(url);
        console.log(`${mod.name || "PK3"} reconstructed successfully.`);
    }

    return resolvedURLs.join(",");
}

async function prepareGZDoomSettings() {
    GZDOOMSETTINGS.MODURLS = await resolveGZDoomMods();
    window.GZDOOMSETTINGS = GZDOOMSETTINGS;

    return GZDOOMSETTINGS;
}

window.loadPK3FromParts = loadPK3FromParts;
window.resolveGZDoomMods = resolveGZDoomMods;
window.prepareGZDoomSettings = prepareGZDoomSettings;

function postLoad() {
    if (window["myApp"] == null) return;

    window["myApp"].modReplacementHook = function () {
        // Optional mod replacement logic.
    };

    window["myApp"].gzDoomIniHook = function (text) {
        return text;
    };
}

window.postLoad = postLoad;