// json structure
let jsonData = {
    usage: "",
    settings: {
        contentVersion: "",
        ownerName: "",
        ownerIdentifier: "",
        appVersion: "",
        chapter: "",
        calibrateAfterStageID: "",
        unit: "mm",
        langCode: "",
        creatorID: 0
    },
    process: {
        processTitle: "",
        processDesc: "",
        workspaceShape: "square",
        workspaceShapeSize: { x: 0, y: 0, z: 0 },
        workspaceShapeRot: { x: 0, y: 0, z: 0 },
        workspaceOffsetPos: { x: 0, y: 0, z: 0 },
        workspaceOffsetRot: { x: 0, y: 0, z: 0 },
        mainHologram: "",
        topics: [],
        courses: []
    }
};

// let topicIdCounter = 1;
let courseIdCounter = 1;
let quizzIdCounter = 1;


// Gestion des fichiers
document.addEventListener('DOMContentLoaded', function () {
    // Si la page a été rechargée manuellement ou ouverte directement, on efface les données en mémoire
    const isInternalNav = sessionStorage.getItem('is_navigating') === 'true';
    sessionStorage.removeItem('is_navigating');
    if (!isInternalNav) {
        sessionStorage.removeItem('iximaker_variant_data');
        sessionStorage.removeItem('iximaker_work_owner');
        sessionStorage.removeItem('iximaker_learn_owner');
    }

    // Init custom select for orientation on mobile
    const nativeSelect = document.getElementById('workspaceShapeRot');
    const customSelect = document.getElementById('custom-orientation-select');
    if (nativeSelect && customSelect) {
        const trigger = customSelect.querySelector('.custom-select-trigger');
        const textSpan = customSelect.querySelector('.custom-select-text');
        const options = customSelect.querySelectorAll('.custom-option');

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            customSelect.classList.toggle('open');
        });

        document.addEventListener('click', () => {
            customSelect.classList.remove('open');
        });

        options.forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = option.dataset.value;
                const text = option.textContent;

                options.forEach(opt => opt.classList.remove('active'));
                option.classList.add('active');
                textSpan.textContent = text;
                customSelect.classList.remove('open');

                nativeSelect.value = value;
                nativeSelect.dispatchEvent(new Event('change'));
            });
        });

        nativeSelect.addEventListener('change', () => {
            const val = nativeSelect.value;
            options.forEach(opt => {
                if (opt.dataset.value === val) {
                    options.forEach(o => o.classList.remove('active'));
                    opt.classList.add('active');
                    textSpan.textContent = opt.textContent;
                }
            });
        });
    }

    // Init custom select for shape on mobile
    const nativeShapeSelect = document.getElementById('workspaceShape');
    const customShapeSelect = document.getElementById('custom-shape-select');
    if (nativeShapeSelect && customShapeSelect) {
        const trigger = customShapeSelect.querySelector('.custom-select-trigger');
        const textSpan = customShapeSelect.querySelector('.custom-select-text');
        const options = customShapeSelect.querySelectorAll('.custom-option');

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            customShapeSelect.classList.toggle('open');
        });

        document.addEventListener('click', () => {
            customShapeSelect.classList.remove('open');
        });

        options.forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = option.dataset.value;
                const text = option.textContent;

                options.forEach(opt => opt.classList.remove('active'));
                option.classList.add('active');
                textSpan.textContent = text;
                customShapeSelect.classList.remove('open');

                nativeShapeSelect.value = value;
                nativeShapeSelect.dispatchEvent(new Event('change'));
            });
        });

        nativeShapeSelect.addEventListener('change', () => {
            const val = nativeShapeSelect.value;
            options.forEach(opt => {
                if (opt.dataset.value === val) {
                    options.forEach(o => o.classList.remove('active'));
                    opt.classList.add('active');
                    textSpan.textContent = opt.textContent;
                }
            });
        });
    }

    // Init custom select for position on mobile
    const nativePositionSelect = document.getElementById('workspaceOffsetCalc');
    const customPositionSelect = document.getElementById('custom-position-select');
    if (nativePositionSelect && customPositionSelect) {
        const trigger = customPositionSelect.querySelector('.custom-select-trigger');
        const textSpan = customPositionSelect.querySelector('.custom-select-text');
        const options = customPositionSelect.querySelectorAll('.custom-option');

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            customPositionSelect.classList.toggle('open');
        });

        document.addEventListener('click', () => {
            customPositionSelect.classList.remove('open');
        });

        options.forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = option.dataset.value;
                const text = option.textContent;

                options.forEach(opt => opt.classList.remove('active'));
                option.classList.add('active');
                textSpan.textContent = text;
                customPositionSelect.classList.remove('open');

                nativePositionSelect.value = value;
                nativePositionSelect.dispatchEvent(new Event('change'));
            });
        });

        nativePositionSelect.addEventListener('change', () => {
            const val = nativePositionSelect.value;
            options.forEach(opt => {
                if (opt.dataset.value === val) {
                    options.forEach(o => o.classList.remove('active'));
                    opt.classList.add('active');
                    textSpan.textContent = opt.textContent;
                }
            });
        });
    }

    // Initial mobile button text & resize observer
    const offsetBtn = document.getElementById('workspaceOffsetToggleBtn');
    const fields = document.getElementById('workspaceOffsetCustomFields');
    function updateToggleBtnText() {
        if (!offsetBtn || !fields) return;
        const isHidden = fields.style.display === 'none' || fields.style.display === '';
        if (window.innerWidth <= 900) {
            offsetBtn.textContent = isHidden ? 'Décalages personnalisés' : 'Masquer les décalages';
        } else {
            offsetBtn.textContent = isHidden ? 'Afficher les décalages personnalisés' : 'Masquer les décalages personnalisés';
        }
    }
    updateToggleBtnText();
    window.addEventListener('resize', updateToggleBtnText);

    // Auto-load variant data from memory if present on load
    const stored = sessionStorage.getItem('iximaker_variant_data');
    if (stored) {
        try {
            const variantData = JSON.parse(stored);
            loadDataToForm(variantData);
        } catch(e) {
            console.error("Error auto-loading memory variant:", e);
        }
    }
    checkSharedVariant();

    const form = document.getElementById('jsonForm');
    if (form) {
        form.addEventListener('input', saveAndRefreshVariant);
        form.addEventListener('change', saveAndRefreshVariant);
    }

    // Gestionnaire pour l'hologramme principal
    const mainHologramFile = document.getElementById('mainHologram-file');
    if (mainHologramFile) {
        mainHologramFile.addEventListener('change', function (e) {
            if (e.target.files.length > 0) {
                const hologramInput = document.getElementById('mainHologram');
                if (hologramInput) hologramInput.value = e.target.files[0].name;
            }
        });
    }

    // Gestionnaire pour l'import JSON
    const jsonImportElem = document.getElementById('json-import');
    if (jsonImportElem) {
        jsonImportElem.addEventListener('change', function (e) {
            if (e.target.files.length > 0) {
                // Ne rien faire ici, l'import sera déclenché par la fonction importJSON()
            }
        });
    }

// Global flag to prevent resets during form loading
let isSettingData = false;

    // Gestionnaire pour changer les labels du menu Position selon l'orientation
    function updatePositionLabels(resetToMiddle = false) {
        const orientationSelect = document.getElementById('workspaceShapeRot');
        const positionSelect = document.getElementById('workspaceOffsetCalc');
        const positionLabel = document.getElementById('positionLabel');
        const offsetPosPLabel = document.getElementById('workspaceOffsetPosPLabel');

        if (!orientationSelect || !positionSelect) return;

        const isHorizontal = orientationSelect.value === '0';
        const currentValue = (resetToMiddle && !isSettingData) ? 'auto-mid' : positionSelect.value;

        // Mettre à jour les options
        positionSelect.innerHTML = isHorizontal
            ? '<option value="auto-high">Surface</option><option value="auto-mid">Milieu</option><option value="auto-low">Base</option>'
            : '<option value="auto-high">Surface</option><option value="auto-mid">Milieu</option><option value="auto-low">Fond</option>';

        // Mettre à jour le tooltip du label
        if (positionLabel) {
            positionLabel.title = isHorizontal
                ? 'ℹ️ Position de la zone de travail,\npar rapport à l\'hologramme (ex : plan de travail)'
                : 'ℹ️ Position en profondeur de la zone de travail,\n par rapport à l\'hologramme (ex : mur)';
        }

        // Mettre à jour le label Offset Pos P/H selon l'orientation
        if (offsetPosPLabel) {
            if (isHorizontal) {
                offsetPosPLabel.innerHTML = 'P (mm) <span class="icon-color">ℹ️</span>';
                offsetPosPLabel.title = 'ℹ️ Décalage de la profondeur de la zone de travail (mm)\npar rapport à l\'hologramme';
            } else {
                offsetPosPLabel.innerHTML = 'H (mm) <span class="icon-color">ℹ️</span>';
                offsetPosPLabel.title = 'ℹ️ Décalage en hauteur de la zone de travail (mm)\npar rapport à l\'hologramme';
            }
        }

        // Restaurer ou réinitialiser la valeur
        positionSelect.value = currentValue;
    }

    // Initialiser les labels au chargement
    updatePositionLabels();

    // Écouter les changements d'orientation et réinitialiser à milieu
    const orientationSelect = document.getElementById('workspaceShapeRot');
    if (orientationSelect) {
        orientationSelect.addEventListener('change', () => updatePositionLabels(true));
    }

    window.addEventListener('resize', function() {
        document.querySelectorAll('[id^="feedback-posrot-toggle-"], [id^="quizz-posrot-toggle-"]').forEach(btn => {
            const isClosed = btn.textContent.includes('▼');
            const labelText = window.innerWidth <= 640 ? 'Pos & Rot' : 'Position & rotation';
            btn.textContent = isClosed ? `${labelText} ▼` : `${labelText} ▲`;
        });
    });
});

function toggleWorkspaceOffsetFields() {
    const fields = document.getElementById('workspaceOffsetCustomFields');
    const btn = document.getElementById('workspaceOffsetToggleBtn');
    if (!fields || !btn) return;

    const isHidden = fields.style.display === 'none' || fields.style.display === '';
    fields.style.display = isHidden ? 'flex' : 'none';
    
    if (window.innerWidth <= 900) {
        btn.textContent = isHidden ? 'Masquer les décalages' : 'Décalages personnalisés';
    } else {
        btn.textContent = isHidden ? 'Masquer les décalages personnalisés' : 'Afficher les décalages personnalisés';
    }
}

// Collecter toutes les données du formulaire
function collectFormData() {
    const data = {
        usage: document.getElementById('usage').value,
        settings: {
            contentVersion: document.getElementById('contentVersion').value,
            ownerName: document.getElementById('ownerName').value,
            ownerIdentifier: document.getElementById('ownerIdentifier').value,
            appVersion: document.getElementById('appVersion').value,
            chapter: document.getElementById('chapter').value,
            calibrateAfterStageID: parseInt(document.getElementById('calibrateAfterStageID').value) || 0,
            unit: document.getElementById('unit').value,
            langCode: document.getElementById('langCode').value,
            creatorID: parseInt(document.getElementById('creatorID').value) || 0
        },
        process: {
            processTitle: document.getElementById('processTitle').value,
            processDesc: document.getElementById('processDesc').value,
            workspaceShape: document.getElementById('workspaceShape').value,
            workspaceShapeSize: {
                x: parseInt(document.querySelector('input[name="process.workspaceShapeSize.x"]').value) || 0,
                y: parseInt(document.querySelector('input[name="process.workspaceShapeSize.y"]').value) || 0,
                z: parseInt(document.querySelector('input[name="process.workspaceShapeSize.z"]').value) || 0
            },
            workspaceShapeRot: (() => {
                const rotSelectVal = parseInt(document.querySelector('select[name="process.workspaceShapeRot.z"]').value) || 0;
                return {
                    x: rotSelectVal === 90 ? -90 : 0,
                    y: parseInt(document.querySelector('input[name="process.workspaceShapeRot.y"]')?.value) || 0,
                    z: 0
                };
            })(),
            workspaceOffsetPos: {
                // X manuel via le champ Offset Pos P (mm)
                x: (() => {
                    const manualX = parseFloat(document.getElementById('workspaceOffsetPosP')?.value);
                    if (!Number.isNaN(manualX)) {
                        return parseInt(Math.round(manualX));
                    }
                    return parseInt(document.querySelector('input[name="process.workspaceOffsetPos.x"]')?.value) || 0;
                })(),

                //  Modification de calcule de la hauteur (Y) 
                y: (() => {
                    // On récupère l'orientation
                    const orientationSelect = document.getElementById('workspaceShapeRot');
                    const isHorizontal = orientationSelect && orientationSelect.value === '0';

                    // Le calcul haut/milieu/bas ne s'applique que pour l'orientation horizontale
                    if (isHorizontal) {
                        // On récupère le choix du menu
                        const selection = document.getElementById('workspaceOffsetCalc').value;
                        // On récupère la hauteur via l'ID ajouté
                        const inputH = document.getElementById('inputHauteur');
                        const hauteur = inputH ? (parseFloat(inputH.value) || 0) : 0;

                        if (selection === 'auto-high') {
                            return parseInt(Math.round(hauteur / 2));
                        } else if (selection === 'auto-low') {
                            return parseInt(Math.round(-(hauteur / 2)));
                        } else if (selection === 'auto-mid') {
                            return 0;
                        } else {
                            // Fallback
                            return 0;
                        }
                    } else {
                        // Pour orientation verticale, pas de décalage Y
                        return 0;
                    }
                })(),

                // Z manuel via le champ Offset Pos L (mm)
                z: (() => {
                    const manualZ = parseFloat(document.getElementById('workspaceOffsetPosL')?.value);
                    if (!Number.isNaN(manualZ)) {
                        return parseInt(Math.round(manualZ));
                    }
                    return parseInt(document.querySelector('input[name="process.workspaceOffsetPos.z"]')?.value) || 0;
                })(),
            },

            workspaceOffsetRot: {
                x: parseInt(document.querySelector('input[name="process.workspaceOffsetRot.x"]').value) || 0,
                y: parseInt(document.querySelector('input[name="process.workspaceOffsetRot.y"]').value) || 0,
                z: parseInt(document.querySelector('input[name="process.workspaceOffsetRot.z"]').value) || 0
            },
            mainHologram: document.getElementById('mainHologram').value,
            workspaceOffsetCalc: document.getElementById('workspaceOffsetCalc')?.value || 'auto-mid',
            topics: jsonData.process?.topics || [],
            courses: jsonData.process?.courses || []
        }
    };

    return data;
}

// Générer le JSON
function generateJSON() {
    try {
        const data = collectFormData();
        const jsonString = JSON.stringify(data, null, 2);
        document.getElementById('json-output').value = jsonString;
        showMessage('JSON généré avec succès !');
        showTab('import-export');
    } catch (error) {
        alert('Erreur lors de la génération du JSON : ' + error.message);
    }
}

// Exporter le JSON
function exportJSON() {
    const data = collectFormData();
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'variant.json';

    a.click();
    URL.revokeObjectURL(url);
    showMessage('JSON exporté avec succès !');
}

// Charger les données dans le formulaire
function loadDataToForm(data, isImporting = false) {
    isSettingData = true;
    // Charger les paramètres généraux
    document.getElementById('usage').value = data.usage || '';
    document.getElementById('contentVersion').value = data.settings?.contentVersion || '';
    
    const importedOwnerName = data.settings?.ownerName || '';
    const importedOwnerId = data.settings?.ownerIdentifier || '';

    if (importedOwnerName) {
        document.getElementById('ownerName').value = importedOwnerName;
        if (isImporting) {
            sessionStorage.setItem('iximaker_learn_owner', importedOwnerName);
            sessionStorage.setItem('iximaker_work_owner', importedOwnerName);
        }
    }
    if (importedOwnerId) {
        document.getElementById('ownerIdentifier').value = importedOwnerId;
    }
    document.getElementById('appVersion').value = data.settings?.appVersion || '';
    document.getElementById('chapter').value = data.settings?.chapter || '';
    document.getElementById('calibrateAfterStageID').value = data.settings?.calibrateAfterStageID || '';
    document.getElementById('unit').value = data.settings?.unit || 'mm';
    document.getElementById('langCode').value = data.settings?.langCode || '';
    document.getElementById('creatorID').value = data.settings?.creatorID || 0;

    // Charger les informations du processus
    document.getElementById('processTitle').value = data.process?.processTitle || '';
    document.getElementById('processDesc').value = data.process?.processDesc || '';
    document.getElementById('workspaceShape').value = data.process?.workspaceShape || 'square';
    document.getElementById('mainHologram').value = data.process?.mainHologram || '';

    // Charger les vecteurs 3D
    document.querySelector('input[name="process.workspaceShapeSize.x"]').value = data.process?.workspaceShapeSize?.x || 0;
    document.querySelector('input[name="process.workspaceShapeSize.y"]').value = data.process?.workspaceShapeSize?.y || 0;
    document.querySelector('input[name="process.workspaceShapeSize.z"]').value = data.process?.workspaceShapeSize?.z || 0;

    // x et y sont des input hidden, z est un select (l'orientation)
    var wsRotX = document.querySelector('input[name="process.workspaceShapeRot.x"]');
    if (wsRotX) wsRotX.value = data.process?.workspaceShapeRot?.x || 0;
    var wsRotY = document.querySelector('input[name="process.workspaceShapeRot.y"]');
    if (wsRotY) wsRotY.value = data.process?.workspaceShapeRot?.y || 0;
    
    // Déterminer la valeur du select d'orientation
    var wsRotZ = document.querySelector('select[name="process.workspaceShapeRot.z"]');
    if (wsRotZ) {
        const isVertical = (data.process?.workspaceShapeRot?.x === -90 || data.process?.workspaceShapeRot?.z === 90);
        wsRotZ.value = isVertical ? 90 : 0;
        wsRotZ.dispatchEvent(new Event('change'));
    }

    document.querySelector('input[name="process.workspaceOffsetPos.x"]').value = data.process?.workspaceOffsetPos?.x || 0;
    document.querySelector('input[name="process.workspaceOffsetPos.y"]').value = data.process?.workspaceOffsetPos?.y || 0;
    document.querySelector('input[name="process.workspaceOffsetPos.z"]').value = data.process?.workspaceOffsetPos?.z || 0;
    
    // Déduire et restaurer la position du select workspaceOffsetCalc
    const positionSelect = document.getElementById('workspaceOffsetCalc');
    if (positionSelect) {
        if (data.process?.workspaceOffsetCalc) {
            positionSelect.value = data.process.workspaceOffsetCalc;
        } else {
            const yVal = data.process?.workspaceOffsetPos?.y || 0;
            const hVal = data.process?.workspaceShapeSize?.y || 0;
            if (hVal > 0 && Math.abs(yVal - Math.round(hVal / 2)) <= 1) {
                positionSelect.value = 'auto-high';
            } else if (hVal > 0 && Math.abs(yVal - Math.round(-hVal / 2)) <= 1) {
                positionSelect.value = 'auto-low';
            } else {
                positionSelect.value = 'auto-mid';
            }
        }
        positionSelect.dispatchEvent(new Event('change'));
    }
    
    const offsetPInput = document.getElementById('workspaceOffsetPosP');
    if (offsetPInput) offsetPInput.value = data.process?.workspaceOffsetPos?.x || 0;
    const offsetLInput = document.getElementById('workspaceOffsetPosL');
    if (offsetLInput) offsetLInput.value = data.process?.workspaceOffsetPos?.z || 0;

    document.querySelector('input[name="process.workspaceOffsetRot.x"]').value = data.process?.workspaceOffsetRot?.x || 0;
    document.querySelector('input[name="process.workspaceOffsetRot.y"]').value = data.process?.workspaceOffsetRot?.y || 0;
    document.querySelector('input[name="process.workspaceOffsetRot.z"]').value = data.process?.workspaceOffsetRot?.z || 0;

    // Réinitialiser les conteneurs
    const topicsCont = document.getElementById('topics-container');
    if (topicsCont) topicsCont.innerHTML = '';
    const coursesCont = document.getElementById('courses-container');
    if (coursesCont) coursesCont.innerHTML = '';

    // Fusionner avec les données existantes pour ne pas perdre steps/stages/topics/courses non présents
    let existingData = {};
    try {
        const stored = sessionStorage.getItem('iximaker_variant_data');
        if (stored) {
            existingData = JSON.parse(stored);
        }
    } catch (e) {
        console.error("Error reading existing variant data:", e);
    }

    if (!data.process) data.process = {};

    if (existingData.process) {
        if ((!data.process.topics || data.process.topics.length === 0) && existingData.process.topics) {
            data.process.topics = existingData.process.topics;
        }
        if ((!data.process.courses || data.process.courses.length === 0) && existingData.process.courses) {
            data.process.courses = existingData.process.courses;
        }
        if ((!data.process.steps || data.process.steps.length === 0) && existingData.process.steps) {
            data.process.steps = existingData.process.steps;
        }
        if ((!data.process.stages || data.process.stages.length === 0) && existingData.process.stages) {
            data.process.stages = existingData.process.stages;
        }
    }

    // Si le JSON contenait des topics et courses, on les met de côté dans jsonData
    jsonData.process.topics = Array.isArray(data.process?.topics) ? data.process.topics : [];
    jsonData.process.courses = Array.isArray(data.process?.courses) ? data.process.courses : [];

    // Save loaded data into sessionStorage and update banner
    sessionStorage.setItem('iximaker_variant_data', JSON.stringify(data));
    checkSharedVariant();
    isSettingData = false;
}

// Importer JSON
function importJSON() {
    const fileInput = document.getElementById('json-import');
    if (fileInput.files.length === 0) {
        alert('Veuillez sélectionner un fichier JSON');
        return;
    }
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const imported = JSON.parse(e.target.result);
            loadDataToForm(imported, true);
            showMessage('JSON importé avec succès !');
        } catch (error) {
            alert('Erreur lors de l\'import du JSON : ' + error.message);
        }
    };
    reader.readAsText(file);
}

// Réinitialiser le formulaire
function resetForm(bypassConfirm = false) {
    if (bypassConfirm || confirm('Êtes-vous sûr de vouloir réinitialiser le formulaire ? Toutes les données seront perdues.')) {
        document.getElementById('jsonForm').reset();
        document.getElementById('topics-container').innerHTML = '';
        document.getElementById('courses-container').innerHTML = '';
        jsonData = {
            usage: "",
            settings: {
                contentVersion: "",
                ownerName: "",
                ownerIdentifier: "",
                appVersion: "",
                chapter: "",
                calibrateAfterStageID: "",
                unit: "mm",
                langCode: "",
                creatorID: 0
            },
            process: {
                processTitle: "",
                processDesc: "",
                workspaceShape: "square",
                workspaceShapeSize: { x: 0, y: 0, z: 0 },
                workspaceShapeRot: { x: 0, y: 0, z: 0 },
                workspaceOffsetPos: { x: 0, y: 0, z: 0 },
                workspaceOffsetRot: { x: 0, y: 0, z: 0 },
                mainHologram: "",
                topics: [],
                courses: []
            }
        };
        courseIdCounter = 1;
        quizzIdCounter = 1;
        showMessage('Formulaire réinitialisé');
    }
}


function saveSharedVariant(data) {
    try {
        let existingData = {};
        const stored = sessionStorage.getItem('iximaker_variant_data');
        if (stored) {
            existingData = JSON.parse(stored);
        }
        if (existingData.process) {
            if (!data.process.steps && existingData.process.steps) {
                data.process.steps = existingData.process.steps;
            }
            if (!data.process.stages && existingData.process.stages) {
                data.process.stages = existingData.process.stages;
            }
            if (!data.process.topics && existingData.process.topics) {
                data.process.topics = existingData.process.topics;
            }
            if (!data.process.courses && existingData.process.courses) {
                data.process.courses = existingData.process.courses;
            }
        }
        sessionStorage.setItem('iximaker_variant_data', JSON.stringify(data));
    } catch (err) {
        console.error('Error saving shared variant:', err);
        sessionStorage.setItem('iximaker_variant_data', JSON.stringify(data));
    }
}

function transferTo(target) {
    try {
        const data = collectFormData();
        saveSharedVariant(data);
        sessionStorage.setItem('is_navigating', 'true');
        showMessage('Données de variante enregistrées en mémoire ! Redirection...');
        setTimeout(() => {
            if (target === 'Learn') {
                window.location.href = 'iXiMAKER-Learn.html';
            } else if (target === 'Work') {
                window.location.href = 'iXiMAKER-Work.html';
            }
        }, 1000);
    } catch (error) {
        alert('Erreur lors du transfert : ' + error.message);
    }
}
function saveAndRefreshVariant() {
    try {
        const data = collectFormData();
        saveSharedVariant(data);
        checkSharedVariant();
    } catch(e) {
        console.error(e);
    }
}

function checkSharedVariant() {
    try {
        const stored = sessionStorage.getItem('iximaker_variant_data');
        const banner = document.getElementById('shared-variant-banner');
        const titleSpan = document.getElementById('shared-variant-title');
        const infoSpan = document.getElementById('shared-variant-info');
        const reference = document.getElementById('shared-variant-reference');

        if (stored && banner && titleSpan && infoSpan) {
            const variantData = JSON.parse(stored);
            const processTitle = variantData.process?.processTitle || 'Sans nom';
            const shape = variantData.process?.workspaceShape || '';
            const size = variantData.process?.workspaceShapeSize;
            const sizeStr = size ? `(${size.x}x${size.y}x${size.z}mm)` : '';
            const referenceText = variantData.settings?.chapter || 'Aucune référence';
            
            reference.textContent = referenceText;
            titleSpan.textContent = processTitle;
            infoSpan.textContent = `${shape} ${sizeStr}`;
            banner.style.display = 'flex';
        } else if (banner) {
            banner.style.display = 'none';
        }
    } catch (err) {
        console.error('Error checking shared variant:', err);
    }
}

function clearSharedVariant() {
    sessionStorage.removeItem('iximaker_variant_data');
    sessionStorage.removeItem('iximaker_work_owner');
    sessionStorage.removeItem('iximaker_learn_owner');
    const banner = document.getElementById('shared-variant-banner');
    if (banner) banner.style.display = 'none';
    resetForm(true);
    showMessage('Variante effacée de la mémoire et formulaire réinitialisé');
}
function headerNavigate(targetUrl) {
    try {
        sessionStorage.setItem('is_navigating', 'true');
        if (!sessionStorage.getItem('iximaker_variant_data')) {
            window.location.href = targetUrl;
            return;
        }
        const data = collectFormData();
        saveSharedVariant(data);
        window.location.href = targetUrl;
    } catch (e) {
        window.location.href = targetUrl;
    }
}
