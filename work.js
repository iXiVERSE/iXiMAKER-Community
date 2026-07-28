
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
                steps: [],
                stages: []
            }
        };

        // let stepIdCounter = 1;
        let stageIdCounter = 1;
        let actionIdCounter = 1;


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

            // Gestionnaire pour l'hologramme principal
            const mainHoloFile = document.getElementById('mainHologram-file');
            if (mainHoloFile) {
                mainHoloFile.addEventListener('change', function (e) {
                    if (e.target.files.length > 0) {
                        const mainHolo = document.getElementById('mainHologram');
                        if (mainHolo) mainHolo.value = e.target.files[0].name;
                    }
                });
            }

            // Gestionnaire pour l'import JSON
            const jsonImport = document.getElementById('json-import');
            if (jsonImport) {
                jsonImport.addEventListener('change', function (e) {
                    if (e.target.files.length > 0) {
                        // Ne rien faire ici, l'import sera déclenché par un bouton via la fonction importJSON()
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

            // Initial check for shared variant data in memory
            try {
                const stored = sessionStorage.getItem('iximaker_variant_data');
                if (stored) {
                    const variantData = JSON.parse(stored);
                    loadDataToForm(variantData, false);
                }
                const localOwner = sessionStorage.getItem('iximaker_work_owner');
                if (localOwner) {
                    const ownerInput = document.getElementById('ownerName');
                    if (ownerInput) ownerInput.value = localOwner;
                }
            } catch (err) {
                console.error('Error loading session variant data:', err);
            }
            checkSharedVariant();

            const ownerInput = document.getElementById('ownerName');
            if (ownerInput) {
                ownerInput.addEventListener('input', (e) => {
                    sessionStorage.setItem('iximaker_work_owner', e.target.value);
                });
            }
        });

        function toggleWorkspaceOffsetFields() {
            const fields = document.getElementById('workspaceOffsetCustomFields');
            const btn = document.getElementById('workspaceOffsetToggleBtn');
            if (!fields || !btn) return;

            const isHidden = fields.style.display === 'none' || fields.style.display === '';
            fields.style.display = isHidden ? 'flex' : 'none';
            btn.textContent = isHidden ? 'Masquer les décalages personnalisés' : 'Afficher les décalages personnalisés';
        }


        // ---- Gestion du drag & drop pour les chemins d'étapes des stages ----
        function initStagePathBuilder(stageIndex) {
            const availableContainer = document.getElementById(`stageAvailableSteps-${stageIndex}`);
            const selectedContainer = document.getElementById(`stageSelectedSteps-${stageIndex}`);
            const hiddenInput = document.getElementById(`stagePath-input-${stageIndex}`);

            if (!availableContainer || !selectedContainer || !hiddenInput) return;

            // Nettoyer
            availableContainer.innerHTML = '';
            selectedContainer.innerHTML = '';

            // Construire la liste des IDs d'étapes à partir du JSON
            const steps = jsonData.process.steps || [];

            // Étapes déjà utilisées dans ce stage (ne doivent pas apparaître dans la liste disponible)
            const usedIds = (hiddenInput.value || '')
                .split('.')
                .map(v => v.trim())
                .filter(v => v);

            steps.forEach((step, idx) => {
                const stepId = String(step.stepID || (idx + 1));

                // Si déjà utilisé dans le chemin, ne pas l'afficher dans la liste des disponibles
                if (usedIds.includes(stepId)) {
                    return;
                }

                const title = step.stepTitle || `Étape ${stepId}`;
                const item = document.createElement('div');
                item.className = 'stage-step-item';
                item.draggable = true;
                item.dataset.stepId = stepId;
                item.textContent = `Étape ${stepId} - ${title}`;

                // Clic : ajouter/enlever du chemin
                item.addEventListener('click', function () {
                    toggleStepInStagePath(stageIndex, stepId, title);
                });

                setupDragEventsForItem(item, stageIndex);
                availableContainer.appendChild(item);
            });

            setupStageSelectedListDnD(stageIndex);

            // Si un chemin existe déjà dans l'input caché, le refléter dans l'UI
            if (hiddenInput.value) {
                applyStagePathToUI(stageIndex, hiddenInput.value);
            }
        }

        function refreshAllStagePathBuilders() {
            const stagesContainer = document.getElementById('stages-container');
            if (!stagesContainer) return;

            for (let i = 0; i < stagesContainer.children.length; i++) {
                initStagePathBuilder(i);
            }
        }

        function toggleStepInStagePath(stageIndex, stepId, title) {
            const selectedContainer = document.getElementById(`stageSelectedSteps-${stageIndex}`);
            const hiddenInput = document.getElementById(`stagePath-input-${stageIndex}`);
            if (!selectedContainer || !hiddenInput) return;

            // Vérifier si déjà présent
            const existing = Array.from(selectedContainer.children).find(el => el.dataset.stepId == stepId);

            if (existing) {
                selectedContainer.removeChild(existing);
            } else {
                const item = createStageSelectedItem(stageIndex, stepId, title);
                selectedContainer.appendChild(item);
            }

            updateStagePathFromUI(stageIndex);
            // Rebuild pour refléter la nouvelle répartition disponible / sélectionné
            initStagePathBuilder(stageIndex);
        }

        function setupDragEventsForItem(item, stageIndex) {
            item.addEventListener('dragstart', function (e) {
                if (e.target && e.target.closest('.stage-step-item-controls')) {
                    e.preventDefault();
                    return;
                }
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', JSON.stringify({
                    stageIndex,
                    stepId: item.dataset.stepId,
                    text: item.textContent
                }));
            });

            item.addEventListener('dragend', function () {
                item.classList.remove('dragging');
            });
        }

        function setupStageSelectedListDnD(stageIndex) {
            const selectedContainer = document.getElementById(`stageSelectedSteps-${stageIndex}`);
            const availableContainer = document.getElementById(`stageAvailableSteps-${stageIndex}`);
            if (!selectedContainer) return;

            selectedContainer.addEventListener('dragover', function (e) {
                e.preventDefault();
                selectedContainer.classList.add('drag-over');
                const afterElement = getDragAfterElement(selectedContainer, e.clientX, e.clientY);
                const dragging = document.querySelector('.stage-step-item.dragging');
                if (!dragging) return;
                if (afterElement == null) {
                    selectedContainer.appendChild(dragging);
                } else {
                    selectedContainer.insertBefore(dragging, afterElement);
                }
            });

            selectedContainer.addEventListener('dragleave', function () {
                selectedContainer.classList.remove('drag-over');
            });

            selectedContainer.addEventListener('drop', function (e) {
                e.preventDefault();
                selectedContainer.classList.remove('drag-over');

                const dataText = e.dataTransfer.getData('text/plain');
                if (dataText) {
                    try {
                        const data = JSON.parse(dataText);
                        if (data.stageIndex === stageIndex) {
                            // Si l'élément vient de la liste des disponibles, l'ajouter
                            const alreadyInSelected = Array.from(selectedContainer.children)
                                .some(el => el.dataset.stepId == data.stepId);
                            if (!alreadyInSelected) {
                                const title = String(data.text || '').replace(/^Étape\s+\d+\s+-\s+/, '') || `Étape ${data.stepId}`;
                                const item = createStageSelectedItem(stageIndex, data.stepId, title);

                                const afterElement = getDragAfterElement(selectedContainer, e.clientX, e.clientY);
                                if (afterElement == null) {
                                    selectedContainer.appendChild(item);
                                } else {
                                    selectedContainer.insertBefore(item, afterElement);
                                }
                            }
                        }
                    } catch (err) {
                        // ignore
                    }
                }

                updateStagePathFromUI(stageIndex);
            });

            // Ajouter la gestion du drag & drop pour la colonne disponible (pour supprimer)
            if (availableContainer) {
                availableContainer.addEventListener('dragover', function (e) {
                    e.preventDefault();
                    availableContainer.classList.add('drag-over');
                });

                availableContainer.addEventListener('dragleave', function () {
                    availableContainer.classList.remove('drag-over');
                });

                availableContainer.addEventListener('drop', function (e) {
                    e.preventDefault();
                    availableContainer.classList.remove('drag-over');

                    const dataText = e.dataTransfer.getData('text/plain');
                    if (dataText) {
                        try {
                            const data = JSON.parse(dataText);
                            if (data.stageIndex === stageIndex) {
                                // Supprimer l'élément de la colonne sélectionnée
                                const elementToRemove = Array.from(selectedContainer.children)
                                    .find(el => el.dataset.stepId == data.stepId);
                                if (elementToRemove) {
                                    selectedContainer.removeChild(elementToRemove);
                                    updateStagePathFromUI(stageIndex);
                                    // Rebuild pour refléter la nouvelle répartition
                                    initStagePathBuilder(stageIndex);
                                }
                            }
                        } catch (err) {
                            // ignore
                        }
                    }
                });
            }
        }

        function createStageSelectedItem(stageIndex, stepId, title) {
            const item = document.createElement('div');
            item.className = 'stage-step-item selected';
            item.draggable = true;
            item.dataset.stepId = String(stepId);

            const label = document.createElement('span');
            label.className = 'stage-step-item-label';
            label.textContent = `ID${stepId} - ${title}`;

            const controls = document.createElement('div');
            controls.className = 'stage-step-item-controls';

            const upBtn = document.createElement('button');
            upBtn.type = 'button';
            upBtn.className = 'stage-item-btn';
            upBtn.textContent = '▲';
            upBtn.title = 'Monter';
            upBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                moveStagePathStep(stageIndex, stepId, -1);
            });

            const downBtn = document.createElement('button');
            downBtn.type = 'button';
            downBtn.className = 'stage-item-btn';
            downBtn.textContent = '▼';
            downBtn.title = 'Descendre';
            downBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                moveStagePathStep(stageIndex, stepId, 1);
            });

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'stage-item-btn';
            removeBtn.textContent = '✕';
            removeBtn.title = 'Retirer du stage';
            removeBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                removeStagePathStep(stageIndex, stepId);
            });

            controls.appendChild(upBtn);
            controls.appendChild(downBtn);
            controls.appendChild(removeBtn);
            item.appendChild(label);
            item.appendChild(controls);

            setupDragEventsForItem(item, stageIndex);
            return item;
        }

        function moveStagePathStep(stageIndex, stepId, direction) {
            const selectedContainer = document.getElementById(`stageSelectedSteps-${stageIndex}`);
            if (!selectedContainer) return;

            const items = Array.from(selectedContainer.children);
            const currentIndex = items.findIndex(el => String(el.dataset.stepId) === String(stepId));
            if (currentIndex < 0) return;

            const targetIndex = currentIndex + direction;
            if (targetIndex < 0 || targetIndex >= items.length) return;

            const currentItem = items[currentIndex];
            if (direction < 0) {
                selectedContainer.insertBefore(currentItem, items[targetIndex]);
            } else {
                selectedContainer.insertBefore(currentItem, items[targetIndex].nextSibling);
            }

            updateStagePathFromUI(stageIndex);
        }

        function removeStagePathStep(stageIndex, stepId) {
            const selectedContainer = document.getElementById(`stageSelectedSteps-${stageIndex}`);
            if (!selectedContainer) return;

            const elementToRemove = Array.from(selectedContainer.children)
                .find(el => String(el.dataset.stepId) === String(stepId));
            if (!elementToRemove) return;

            selectedContainer.removeChild(elementToRemove);
            updateStagePathFromUI(stageIndex);
            initStagePathBuilder(stageIndex);
        }

        function getDragAfterElement(container, x, y) {
            const draggableElements = [...container.querySelectorAll('.stage-step-item:not(.dragging)')];

            return draggableElements.reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;
                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                } else {
                    return closest;
                }
            }, { offset: Number.NEGATIVE_INFINITY }).element;
        }

        // Fonction pour obtenir l'élément après lequel insérer une action lors du drag
        // Fonction pour obtenir l'élément après lequel insérer un step lors du drag
        function getDragAfterElementForSteps(container, y) {
            const draggableElements = [...container.querySelectorAll(':scope > .array-item.section-step:not(.dragging)')];

            return draggableElements.reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;
                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                } else {
                    return closest;
                }
            }, { offset: Number.NEGATIVE_INFINITY }).element;
        }

        function getDragAfterElementForActions(container, y) {
            const draggableElements = [...container.querySelectorAll('.array-item.section-action:not(.dragging)')];

            return draggableElements.reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;
                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                } else {
                    return closest;
                }
            }, { offset: Number.NEGATIVE_INFINITY }).element;
        }

        // Fonction pour obtenir l'élément après lequel insérer un feedback lors du drag
        function getDragAfterElementForFeedbacks(container, y) {
            const draggableElements = [...container.querySelectorAll('.array-item.section-feedback:not(.dragging)')];

            return draggableElements.reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;
                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                } else {
                    return closest;
                }
            }, { offset: Number.NEGATIVE_INFINITY }).element;
        }

        // Configure le drag & drop pour réordonner les actions
        // Configure le drag & drop pour réordonner les steps
        function setupStepDragAndDrop(stepDiv) {
            // Drag autorisé uniquement quand le step est replié
            stepDiv.draggable = stepDiv.classList.contains('collapsed');

            stepDiv.addEventListener('dragstart', function (e) {
                // Laisse les drag internes (action, feedback) tranquilles
                if (e.target !== stepDiv && (e.target.closest('.section-action') || e.target.closest('.section-feedback'))) {
                    return;
                }
                if (!stepDiv.classList.contains('collapsed')) {
                    e.preventDefault();
                    return;
                }
                stepDiv.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            stepDiv.addEventListener('dragend', function () {
                stepDiv.classList.remove('dragging');
            });
        }

        function setupActionDragAndDrop(actionDiv, stepIndex) {
            // Drag autorisé uniquement quand l'action est repliée
            actionDiv.draggable = actionDiv.classList.contains('collapsed');

            actionDiv.addEventListener('dragstart', function (e) {
                // Laisse les drag internes (feedback) tranquilles
                if (e.target && (e.target.closest('.section-feedback') || e.target.closest('.header-controls'))) {
                    return;
                }
                if (!actionDiv.classList.contains('collapsed')) {
                    e.preventDefault();
                    return;
                }
                actionDiv.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            actionDiv.addEventListener('dragend', function () {
                actionDiv.classList.remove('dragging');
            });
        }

        // Configure le drag & drop pour réordonner les feedbacks d'une action
        function setupFeedbackDragAndDrop(feedbackDiv, stepIndex, actionIndex) {
            feedbackDiv.draggable = true;

            feedbackDiv.addEventListener('dragstart', function (e) {
                e.stopPropagation();
                if (e.target && e.target.closest('.header-controls')) {
                    e.preventDefault();
                    return;
                }
                // Set data to ensure drag is recognized across browsers
                e.dataTransfer.setData('text/plain', 'feedback-drag');
                feedbackDiv.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            feedbackDiv.addEventListener('dragend', function () {
                feedbackDiv.classList.remove('dragging');
            });

            // Empêche mousedown de remonter et de déclencher un drag sur l'action
            feedbackDiv.addEventListener('mousedown', function (e) {
                e.stopPropagation();
            });
        }

        // Configure les événements de drop sur le conteneur de steps
        function setupStepsContainerDrop() {
            const container = document.getElementById('steps-container');
            if (!container) return;

            // Retirer les anciens listeners si présents
            if (container._dragoverHandler) {
                container.removeEventListener('dragover', container._dragoverHandler);
                container.removeEventListener('drop', container._dropHandler);
            }

            container._dragoverHandler = function (e) {
                e.preventDefault();
                const dragging = document.querySelector('.array-item.section-step.dragging');
                if (!dragging) return;

                const afterElement = getDragAfterElementForSteps(container, e.clientY);

                if (afterElement == null) {
                    container.appendChild(dragging);
                } else {
                    container.insertBefore(dragging, afterElement);
                }
            };

            container._dropHandler = function (e) {
                e.preventDefault();
                const dragging = document.querySelector('.array-item.section-step.dragging');
                if (!dragging) return;

                reorderStepsInModel();
                updateStepsIndexes();
            };

            container.addEventListener('dragover', container._dragoverHandler);
            container.addEventListener('drop', container._dropHandler);
        }

        // Configure les événements de drop sur le conteneur d'actions
        function setupActionsContainerDrop(stepIndex) {
            const container = document.getElementById(`actions-container-${stepIndex}`);
            if (!container) return;

            // Retirer les anciens listeners si présents
            container.removeEventListener('dragover', container._dragoverHandler);
            container.removeEventListener('drop', container._dropHandler);
            container.removeEventListener('dragleave', container._dragleaveHandler);

            container._dragoverHandler = function (e) {
                e.preventDefault();
                const afterElement = getDragAfterElementForActions(container, e.clientY);
                const dragging = document.querySelector('.array-item.section-action.dragging');
                if (!dragging) return;

                if (afterElement == null) {
                    container.appendChild(dragging);
                } else {
                    container.insertBefore(dragging, afterElement);
                }
            };

            // Ajouter les nouveaux listeners
            // Reordonner les actions en fonction de l'ordre DOM
            container._dropHandler = function (e) {
                e.preventDefault();

                // Trouver le stepIndex actuel depuis le DOM au lieu d'utiliser celui de la closure
                const stepDiv = container.closest('.section-step');
                const stepsContainer = document.getElementById('steps-container');
                const currentStepIndex = Array.from(stepsContainer.children).indexOf(stepDiv);

                reorderActionsInModel(currentStepIndex);

                // Mettre à jour les titres et IDs immédiatement après le drop
                const actions = container.children;
                for (let j = 0; j < actions.length; j++) {
                    const action = actions[j];
                    const title = action.querySelector(`[id^="action-title-display-"]`);
                    if (title) {
                        const inputTitle = action.querySelector(`input[name$=".actionTitle"]`);
                        const value = inputTitle ? inputTitle.value : '';
                        title.innerHTML = `<b>Action ${j + 1}${value ? ' | </b>' + value : ''}`;
                    }
                }

                updateActionsIndexes(currentStepIndex);
            };

            container._dragleaveHandler = function (e) {
                // Pas d'action nécessaire
            };

            container.addEventListener('dragover', container._dragoverHandler);
            container.addEventListener('drop', container._dropHandler);
            container.addEventListener('dragleave', container._dragleaveHandler);
        }

        // Configure les événements de drop sur le conteneur de feedbacks
        function setupFeedbacksContainerDrop(stepIndex, actionIndex) {
            const container = document.getElementById(`feedbacks-container-${stepIndex}-${actionIndex}`);
            if (!container) return;

            container.removeEventListener('dragover', container._dragoverHandler);
            container.removeEventListener('drop', container._dropHandler);
            container.removeEventListener('dragleave', container._dragleaveHandler);

            container._dragoverHandler = function (e) {
                e.preventDefault();
                const afterElement = getDragAfterElementForFeedbacks(container, e.clientY);
                const dragging = document.querySelector('.array-item.section-feedback.dragging');
                if (!dragging) return;

                if (afterElement == null) {
                    container.appendChild(dragging);
                } else {
                    container.insertBefore(dragging, afterElement);
                }
            };

            container._dropHandler = function (e) {
                e.preventDefault();

                // Trouver les indices actuels depuis le DOM
                const actionDiv = container.closest('.section-action');
                const stepDiv = actionDiv.closest('.section-step');
                const stepsContainer = document.getElementById('steps-container');
                const currentStepIndex = Array.from(stepsContainer.children).indexOf(stepDiv);
                const actionsContainer = stepDiv.querySelector(`[id^="actions-container-"]`);
                const currentActionIndex = Array.from(actionsContainer.children).indexOf(actionDiv);

                reorderFeedbacksInModel(currentStepIndex, currentActionIndex);
                updateFeedbacksIndexes(currentStepIndex, currentActionIndex);
            };

            container._dragleaveHandler = function (e) {
                // no-op
            };

            container.addEventListener('dragover', container._dragoverHandler);
            container.addEventListener('drop', container._dropHandler);
            container.addEventListener('dragleave', container._dragleaveHandler);
        }

        // Réorganise jsonData.process.steps[stepIndex].stepActions selon l'ordre DOM actuel
        // Réorganise le tableau jsonData.process.steps selon l'ordre DOM actuel
        function reorderStepsInModel() {
            const container = document.getElementById('steps-container');
            if (!container) return;

            const stepElements = Array.from(container.children);
            const currentSteps = jsonData.process.steps || [];
            const newStepsOrder = [];

            stepElements.forEach(stepDiv => {
                const tmpInput = stepDiv.querySelector('input[name$=".stepID"]');
                const tmpIdValue = tmpInput ? tmpInput.value : undefined;
                if (!tmpIdValue) return;

                const stepData = currentSteps.find(step => String(step.stepID) === String(tmpIdValue));
                if (stepData) {
                    newStepsOrder.push(stepData);
                }
            });

            newStepsOrder.forEach((stepData, idx) => {
                stepData.stepID = idx + 1;
            });

            jsonData.process.steps = newStepsOrder;
        }

        function reorderActionsInModel(stepIndex) {
            const container = document.getElementById(`actions-container-${stepIndex}`);
            const stepData = jsonData.process.steps[stepIndex];
            if (!container || !stepData) return;

            const actionElements = Array.from(container.children);
            const currentActions = stepData.stepActions || [];
            const newActionsOrder = [];

            actionElements.forEach(actionDiv => {
                const tmpInput = actionDiv.querySelector('input[name$=".actionID"]');
                const tmpIdValue = tmpInput ? tmpInput.value : undefined;
                if (!tmpIdValue) return;

                const actionData = currentActions.find(action => String(action.actionID) === String(tmpIdValue));
                if (actionData) {
                    newActionsOrder.push(actionData);
                }
            });

            newActionsOrder.forEach((actionData, idx) => {
                actionData.actionID = idx + 1;
            });

            stepData.stepActions = newActionsOrder;
        }

        // Réorganise jsonData.process.steps[stepIndex].stepActions[actionIndex].actionFeedbacks selon l'ordre DOM actuel
        function reorderFeedbacksInModel(stepIndex, actionIndex) {
            const container = document.getElementById(`feedbacks-container-${stepIndex}-${actionIndex}`);
            const actionData = jsonData.process.steps[stepIndex]?.stepActions[actionIndex];
            if (!container || !actionData) return;

            const feedbackElements = Array.from(container.children);
            const currentFeedbacks = actionData.actionFeedbacks || [];
            const newOrder = [];

            // Utiliser l'index DOM pour retrouver les données correspondantes
            feedbackElements.forEach((feedbackDiv, domIndex) => {
                // L'ancien index est stocké dans les attributs id/name
                const feedbackIdMatch = feedbackDiv.id.match(/feedback-\d+-\d+-(\d+)/);
                if (feedbackIdMatch) {
                    const oldIndex = parseInt(feedbackIdMatch[1]);
                    if (currentFeedbacks[oldIndex]) {
                        newOrder.push(currentFeedbacks[oldIndex]);
                    }
                }
            });

            actionData.actionFeedbacks = newOrder;
        }

        // Synchronise les champs généraux (procédure / settings) du DOM vers le modèle sans toucher steps/stages
        function syncTopLevelToModelFromDOM() {
            try {
                const cf = collectFormData();
                // Usage & settings
                jsonData.usage = cf.usage;
                jsonData.settings = { ...jsonData.settings, ...cf.settings };
                // Champs généraux du process (sans steps/stages)
                jsonData.process.processTitle = cf.process.processTitle;
                jsonData.process.processDesc = cf.process.processDesc;
                jsonData.process.workspaceShape = cf.process.workspaceShape;
                jsonData.process.workspaceShapeSize = cf.process.workspaceShapeSize;
                jsonData.process.workspaceShapeRot = cf.process.workspaceShapeRot;
                jsonData.process.workspaceOffsetPos = cf.process.workspaceOffsetPos;
                jsonData.process.workspaceOffsetRot = cf.process.workspaceOffsetRot;
                jsonData.process.mainHologram = cf.process.mainHologram;
            } catch (e) {
                // En cas d'erreur de lecture, on n'empêche pas l'action principale
            }
        }

        function updateStagePathFromUI(stageIndex) {
            const selectedContainer = document.getElementById(`stageSelectedSteps-${stageIndex}`);
            const hiddenInput = document.getElementById(`stagePath-input-${stageIndex}`);
            if (!selectedContainer || !hiddenInput) return;

            const ids = Array.from(selectedContainer.children).map(el => el.dataset.stepId);
            hiddenInput.value = ids.join('.');
        }

        function applyStagePathToUI(stageIndex, pathValue) {
            const selectedContainer = document.getElementById(`stageSelectedSteps-${stageIndex}`);
            if (!selectedContainer) return;

            selectedContainer.innerHTML = '';
            if (!pathValue) return;

            const ids = pathValue.split('.').filter(Boolean);
            ids.forEach(id => {
                const stepId = id.trim();
                if (!stepId) return;

                // Retrouver le titre de l'étape
                const step = (jsonData.process.steps || []).find(s => String(s.stepID) === stepId);
                const title = step ? (step.stepTitle || `Étape ${stepId}`) : `Étape ${stepId}`;

                const item = createStageSelectedItem(stageIndex, stepId, title);
                selectedContainer.appendChild(item);
            });
        }

        // Fonction pour ajouter une étape
        function addStep() {
            const container = document.getElementById('steps-container');
            const stepIndex = jsonData.process.steps.length;
            const stepDiv = document.createElement('div');
            stepDiv.className = 'array-item collapsed section-step';
            stepDiv.id = `step-${stepIndex}`;

            stepDiv.innerHTML = `
                <div class="array-item-header">
                    <button type="button" class="btn btn-collapse" onclick="toggleCollapse('step-${stepIndex}')">
                        ⇵ Réduire/Agrandir
                    </button>
                    <span class="array-item-title" id="step-title-display-${stepIndex}">ID${stepIndex + 1} | Étape <b>sans nom</b></span>
                    <div class="header-controls">
                        <button type="button" class="btn btn-add" onclick="duplicateStep(${stepIndex})">
                            ⧉ Dupliquer
                        </button>
                        <button type="button" class="btn btn-remove" onclick="removeStep(${stepIndex})">
                            ✕ Supprimer
                        </button>
                    </div>
                </div>
                <div class="collapsible-content">
                    <div class="form-row">
                            <input type="hidden" name="step[${stepIndex}].stepID" value="${stepIndex + 1}">
                            <div class="form-group">
                                <label title="Nom de l'étape, telle qu'elle sera affichée dans l'interface utilisateur.">Titre de l'étape <span class="icon-color">ℹ️</span></label>
                                <input type="text" name="step[${stepIndex}].stepTitle" placeholder="Ex: Démontage de...">
                            </div>
                            <div class="form-group">
                                <label title="Note informative de l'étape (optionnelle) affichée dans la UI, en dessous de la description de l'étape.">Note <span class="icon-color">ℹ️</span></label>
                                <input type="text" name="step[${stepIndex}].stepNote" placeholder="Ex : informations complémentaires pour l'étape">
                            </div>
                        </div>

                        <div class="form-row" style="margin-top: 30px;">
                            <div class="form-group">
                                <label title="Description de l'étape, telle qu'elle sera affichée dans l'interface utilisateur.">Description <span class="icon-color">ℹ️</span></label>
                                <textarea name="step[${stepIndex}].stepDesc" placeholder="Détails de l'étape..."></textarea>
                            </div>
                            <div class="form-group">
                                <label title="Texte à convertir en commentaire audio. Fournit à l'utilisateur des informations complémentaires sur l'étape en cours.">Texte audio <span class="icon-color">ℹ️</span></label>
                                <textarea name="step[${stepIndex}].stepAudioText" placeholder="Texte du commentaire audio"></textarea>
                            </div>
                        </div>

                        <div class="form-row three-columns" style="margin-top: 30px;">
                            <div class="form-group">
                                <label title="Image de description de l'étape (optionnelle). 👉 Cette image est remplacée dunamiquement par celle de l'action en cours.">Image de l'étape (png/jpg)<span class="icon-color"> ℹ️</span></label>
                                <div class="file-input-wrapper">
                                    <input type="text" name="step[${stepIndex}].stepImg"   placeholder="Aucun nom de fichier">
                                    <input type="file" id="stepImg-${stepIndex}" accept="image/*">
                                    <button type="button" class="file-button" onclick="document.getElementById('stepImg-${stepIndex}').click()">
                                        🔎 Choisir un fichier
                                    </button>
                                </div>
                            </div>
                            <div class="form-group">
                                <label title="Modèle 3D secondaire au format .glb qui permet au choix : 👉 De mettre à jour l'hologramme principal A LA FIN de l'étape. 👉 D'afficher un hologramme additionnel manipulable PENDANT l'étape.">Hologramme secondaire (glb) <span class="icon-color"> ℹ️</span></label>
                                <div class="file-input-wrapper">
                                    <input type="text" name="step[${stepIndex}].stepHologram"  placeholder="Aucun nom de fichier">
                                    <input type="file" id="stepHologram-${stepIndex}" accept=".glb,.gltf">
                                    <button type="button" class="file-button" onclick="document.getElementById('stepHologram-${stepIndex}').click()">
                                        🔎 Choisir un fichier
                                    </button>
                                </div>
                                <label class="checkbox-wrapper" title="ℹ️ Si actif : le modèle 3D sera manipulable Si inactif : l'hologramme principal sera actualisé à la fin de l'étape">
                                    <input type="checkbox" name="step[${stepIndex}].stepHologramInteractable"> Interactif
                                </label>
                            </div>
                            <div class="form-group">
                                <label title="Fichier audio du commentaire. 👉 Pour remplacer un audio, vous devez d'abord supprimer l'existant.">Audio (ogg)<span class="icon-color"> ℹ️</span></label>
                                <div class="file-input-wrapper">
                                    <input type="text" name="step[${stepIndex}].stepAudio"  placeholder="Aucun nom de fichier">
                                    <input type="file" id="stepAudio-${stepIndex}" accept="audio/*">
                                    <button type="button" class="file-button" onclick="document.getElementById('stepAudio-${stepIndex}').click()">
                                        🔎 Choisir un fichier
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div style="display:none;">
                            <input type="hidden" name="step[${stepIndex}].stepHologramOffsetPos.x" id="stepHologramOffsetPosXInput-${stepIndex}" value="0">
                            <input type="hidden" name="step[${stepIndex}].stepHologramOffsetPos.y" id="stepHologramOffsetPosYInput-${stepIndex}" value="0">
                            <input type="hidden" name="step[${stepIndex}].stepHologramOffsetPos.z" id="stepHologramOffsetPosZInput-${stepIndex}" value="0">
                            <input type="hidden" name="step[${stepIndex}].stepHologramOffsetRot.x" id="stepHologramOffsetRotXInput-${stepIndex}" value="0">
                            <input type="hidden" name="step[${stepIndex}].stepHologramOffsetRot.y" id="stepHologramOffsetRotYInput-${stepIndex}" value="0">
                            <input type="hidden" name="step[${stepIndex}].stepHologramOffsetRot.z" id="stepHologramOffsetRotZInput-${stepIndex}" value="0">
                            <input type="number" name="step[${stepIndex}].stepHologramScale" step="0.1" value="1">
                            <div class="form-group" style="display:none;">
                            <input type="checkbox" name="step[${stepIndex}].stepHologramCalibrate">

                        </div>
                    </div>
                    <h3 title="Actions à réaliser pour cette étape.">Liste des actions</h3>
                    <div id="actions-container-${stepIndex}" class="array-container"></div>
                    <button type="button" class="btn btn-add center" onclick="addAction(${stepIndex})">
                        + Ajouter une action
                    </button>
                </div>
            `;

            container.appendChild(stepDiv);

            // Gestionnaires de fichiers pour cette étape
            document.getElementById(`stepImg-${stepIndex}`).addEventListener('change', function (e) {
                if (e.target.files.length > 0) {
                    document.querySelector(`input[name="step[${stepIndex}].stepImg"]`).value = e.target.files[0].name;
                }
            });

            document.getElementById(`stepHologram-${stepIndex}`).addEventListener('change', function (e) {
                if (e.target.files.length > 0) {
                    document.querySelector(`input[name="step[${stepIndex}].stepHologram"]`).value = e.target.files[0].name;
                }
            });

            document.getElementById(`stepAudio-${stepIndex}`).addEventListener('change', function (e) {
                if (e.target.files.length > 0) {
                    document.querySelector(`input[name="step[${stepIndex}].stepAudio"]`).value = e.target.files[0].name;
                }
            });

            jsonData.process.steps.push({
                stepID: stepIndex + 1,
                stepTitle: "",
                stepDesc: "",
                stepImg: "",
                stepHologram: "",
                stepHologramOffsetPos: { x: 0, y: 0, z: 0 },
                stepHologramOffsetRot: { x: 0, y: 0, z: 0 },
                stepHologramScale: "1",
                stepHologramInteractable: false,
                stepHologramCalibrate: false,
                stepAudioText: "",
                stepAudio: "",
                stepNote: "",
                stepActions: []
            });
            // Mise à jour dynamique du titre dans le header de l'étape
            var display = document.getElementById(`step-title-display-${stepIndex}`);
            var input = document.querySelector(`input[name="step[${stepIndex}].stepTitle"]`);

            if (input && display) {
                input.addEventListener('input', function (e) {
                    display.innerHTML = `ID${stepIndex + 1} | ${e.target.value ? escapeHtml(e.target.value) : 'Étape <b>sans nom</b>'}`;
                    // Synchronise le modèle
                    jsonData.process.steps[stepIndex].stepTitle = e.target.value;
                    // Met à jour les listes de stages pour refléter le nouveau titre
                    refreshAllStagePathBuilders();
                });
            }

            // Configure le drag & drop pour ce step
            // setupStepDragAndDrop(stepDiv); // Drag & drop désactivé pour les étapes

            // Ajoute la nouvelle étape aux builders de stages pour qu'elle soit disponible immédiatement
            refreshAllStagePathBuilders();
        }

        // Fonction pour ajouter une action
        function addAction(stepIndex) {
            const container = document.getElementById(`actions-container-${stepIndex}`);
            const actionIndex = jsonData.process.steps[stepIndex].stepActions.length;
            const actionDiv = document.createElement('div');
            actionDiv.className = 'array-item collapsed section-action';
            actionDiv.id = `action-${stepIndex}-${actionIndex}`;

            actionDiv.innerHTML = `
                <div class="array-item-header">
                    <button type="button" class="btn btn-collapse" onclick="toggleCollapse('action-${stepIndex}-${actionIndex}')">
                        ⇵ Réduire/Agrandir
                    </button>
                    <span class="array-item-title" id="action-title-display-${stepIndex}-${actionIndex}">ID${actionIndex + 1} | Action <b>sans nom</b></span>
                    <div class="header-controls">
                        <button type="button" class="btn btn-add action-duplicate-btn" onclick="duplicateAction(${stepIndex}, ${actionIndex})">
                            ⧉ Dupliquer
                        </button>
                        <button type="button" class="btn btn-remove" onclick="removeAction(${stepIndex}, ${actionIndex})">
                            ✕ Supprimer
                        </button>
                        <button type="button" class="stage-item-btn action-move-up-btn" title="Monter" onclick="moveActionInStep(${stepIndex}, ${actionIndex}, -1)">▲</button>
                        <button type="button" class="stage-item-btn action-move-down-btn" title="Descendre" onclick="moveActionInStep(${stepIndex}, ${actionIndex}, 1)">▼</button>
                    </div>
                </div>
                <div class="collapsible-content">
                    <div class="form-row">
                        <!-- Colonne gauche -->
                        <div style="flex: 1; display: flex; flex-direction: column; gap: 15px;">
                            <div class="form-group">
                                <label title="Nom de l'action affiché dans l'interface">Titre (obligatoire) <span class="icon-color">ℹ️</span></label>
                                <input type="hidden" name="action[${stepIndex}][${actionIndex}].actionID">
                                <input type="text" name="action[${stepIndex}][${actionIndex}].actionTitle">
                            </div>
                            <div class="form-group">
                                <label title="Description détaillée de l'action">Description <span class="icon-color">ℹ️</span></label>
                                <textarea name="action[${stepIndex}][${actionIndex}].actionDesc"></textarea>
                            </div>
                        </div>
                        
                        <!-- Colonne droite -->
                        <div style="flex: 1; display: flex; flex-direction: column; gap: 15px;">
                            <div style="display: flex; gap: 15px;">
                                <input type="hidden" name="action[${stepIndex}][${actionIndex}].feedbackItemTemplateID" value="0" step="1">
                                <div class="form-group" style="flex: 1;">
                                    <label title="Image de l'action en cours (optionnelle). ⚠️ Acutalise et remplace l'image de l'étape dès que l'action est activée.">Image de l'action (png/jpg) <span class="icon-color">ℹ️</span></label>
                                    <div class="file-input-wrapper">
                                        <input type="text" name="action[${stepIndex}][${actionIndex}].actionImg"  placeholder="Aucun nom de fichier">
                                        <input type="file" id="actionImg-${stepIndex}-${actionIndex}" accept="image/*">
                                        <button type="button" class="file-button" onclick="document.getElementById('actionImg-${stepIndex}-${actionIndex}').click()">
                                            🔎 Choisir un fichier
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div class="form-group">
                                <label title="Texte qui sera lu par synthèse vocale">Texte audio <span class="icon-color">ℹ️</span></label>
                                <textarea name="action[${stepIndex}][${actionIndex}].actionAudioText"></textarea>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Hologramme, Position et Fichier audio (section indépendante sur une ligne) -->
                    <div class="form-row" style="margin-top: 15px;">
                        <div class="form-group" style="flex: 1;">
                            <label title="[OPTION] Permet d'ajouter un hologramme d'action sur le modèle principal. 👉 Le pivot de l'objet 3D est le même que celui du modèle principal afin de garantir un placement correct.">Hologramme d'action (glb) <span class="icon-color">ℹ️</span></label>
                            <div class="file-input-wrapper">
                                <input type="text" name="action[${stepIndex}][${actionIndex}].actionHologram" placeholder="Aucun nom de fichier">
                                <input type="file" id="actionHologram-${stepIndex}-${actionIndex}" accept=".glb,.gltf">
                                <button type="button" class="file-button" onclick="document.getElementById('actionHologram-${stepIndex}-${actionIndex}').click()">
                                    🔎 Choisir un fichier
                                </button>
                            </div>
                        </div>
                        <input type="hidden" name="action[${stepIndex}][${actionIndex}].actionHologramOffsetPos.x" step="1" value="0" style="flex: 1;">
                        <input type="hidden" name="action[${stepIndex}][${actionIndex}].actionHologramOffsetPos.y" step="1" value="0" style="flex: 1;">
                        <input type="hidden" name="action[${stepIndex}][${actionIndex}].actionHologramOffsetPos.z" step="1" value="0" style="flex: 1;">
                        <div class="form-group" style="flex: 1;">
                            <label title="Fichier audio de commentaire pour l'action">Audio (ogg) <span class="icon-color">ℹ️</span></label>
                            <div class="file-input-wrapper">
                                <input type="text" name="action[${stepIndex}][${actionIndex}].actionAudio" placeholder="Aucun nom de fichier">
                                <input type="file" id="actionAudio-${stepIndex}-${actionIndex}" accept="audio/*">
                                <button type="button" class="file-button" onclick="document.getElementById('actionAudio-${stepIndex}-${actionIndex}').click()">
                                    🔎 Choisir un fichier
                                </button>
                            </div>
                            <label class="checkbox-wrapper">
                                <input type="checkbox" name="action[${stepIndex}][${actionIndex}].audioIsComment" checked>
                                Audio est commentaire
                            </label>                            
                        </div>
                    </div>
                    
                    <div style="display:none;">
                        <h3>Rotation de l'hologramme</h3>
                        <div class="vector3-group">
                            <div class="form-group">
                                <label>X</label>
                                <span class="vector-value" id="actionHologramOffsetRotX-${stepIndex}-${actionIndex}">0</span>
                                <input type="hidden" name="action[${stepIndex}][${actionIndex}].actionHologramOffsetRot.x" id="actionHologramOffsetRotXInput-${stepIndex}-${actionIndex}" value="0">
                            </div>
                            <div class="form-group">
                                <label>Y</label>
                                <span class="vector-value" id="actionHologramOffsetRotY-${stepIndex}-${actionIndex}">0</span>
                                <input type="hidden" name="action[${stepIndex}][${actionIndex}].actionHologramOffsetRot.y" id="actionHologramOffsetRotYInput-${stepIndex}-${actionIndex}" value="0">
                            </div>
                            <div class="form-group">
                                <label>Z</label>
                                <span class="vector-value" id="actionHologramOffsetRotZ-${stepIndex}-${actionIndex}">0</span>
                                <input type="hidden" name="action[${stepIndex}][${actionIndex}].actionHologramOffsetRot.z" id="actionHologramOffsetRotZInput-${stepIndex}-${actionIndex}" value="0">
                            </div>
                        </div>
                    </div>
                    
                    <h3>Liste des indicateurs</h3>
                    <div id="feedbacks-container-${stepIndex}-${actionIndex}" class="array-container"></div>
                    <button type="button" class="btn btn-add center" onclick="addFeedback(${stepIndex}, ${actionIndex})">
                        + Ajouter un indicateur
                    </button>
                </div>
            `;

            container.appendChild(actionDiv);

            // Activer le drag & drop pour cette action
            setupActionDragAndDrop(actionDiv, stepIndex);

            // Configurer le drop sur le conteneur (une seule fois lors de la première action)
            if (actionIndex === 0 || !container._dropHandler) {
                setupActionsContainerDrop(stepIndex);
            }

            // Gestionnaires de texte pour cette action
            var actionDisplay = document.getElementById(`action-title-display-${stepIndex}-${actionIndex}`);
            var actionInput = document.querySelector(`input[name="action[${stepIndex}][${actionIndex}].actionTitle"]`);
            if (actionDisplay) {
                actionDisplay.innerHTML = `<b>Action ${actionIndex + 1}${actionInput && actionInput.value ? ' | </b>' + escapeHtml(actionInput.value) : ''}`;
            }
            if (actionInput && actionDisplay) {
                actionInput.addEventListener('input', function (e) {
                    // Trouver la position actuelle de l'action dans le conteneur
                    const currentActionDiv = actionInput.closest('.section-action');
                    const currentStepDiv = currentActionDiv.closest('.section-step');
                    const stepsContainer = document.getElementById('steps-container');
                    const currentStepIndex = Array.from(stepsContainer.children).indexOf(currentStepDiv);
                    const actionsContainer = document.getElementById(`actions-container-${currentStepIndex}`);
                    const currentActionIndex = actionsContainer ? Array.from(actionsContainer.children).indexOf(currentActionDiv) : 0;

                    actionDisplay.innerHTML = `ID${currentActionIndex + 1} | ${e.target.value ? escapeHtml(e.target.value) : 'Action <b>sans nom</b>'}`;
                });
            }

            // Gestionnaires de fichiers pour cette action
            document.getElementById(`actionImg-${stepIndex}-${actionIndex}`).addEventListener('change', function (e) {
                if (e.target.files.length > 0) {
                    document.querySelector(`input[name="action[${stepIndex}][${actionIndex}].actionImg"]`).value = e.target.files[0].name;
                }
            });

            document.getElementById(`actionHologram-${stepIndex}-${actionIndex}`).addEventListener('change', function (e) {
                if (e.target.files.length > 0) {
                    document.querySelector(`input[name="action[${stepIndex}][${actionIndex}].actionHologram"]`).value = e.target.files[0].name;
                }
            });

            document.getElementById(`actionAudio-${stepIndex}-${actionIndex}`).addEventListener('change', function (e) {
                if (e.target.files.length > 0) {
                    document.querySelector(`input[name="action[${stepIndex}][${actionIndex}].actionAudio"]`).value = e.target.files[0].name;
                }
            });

            if (!jsonData.process.steps[stepIndex].stepActions) {
                jsonData.process.steps[stepIndex].stepActions = [];
            }
            const tmpId = actionIndex + 1;
            jsonData.process.steps[stepIndex].stepActions.push({
                actionID: tmpId,
                actionTitle: "",
                actionDesc: "",
                actionImg: "",
                feedbackItemTemplateID: 0,
                actionHologram: "",
                actionHologramOffsetPos: { x: 0, y: 0, z: 0 },
                actionHologramOffsetRot: { x: 0, y: 0, z: 0 },
                actionAudioText: "",
                actionAudio: "",
                audioIsComment: true,
                actionFeedbacks: []
            });
            // Mise à jour dynamique du tmp_Id
            document.querySelector(`input[name="action[${stepIndex}][${actionIndex}].actionID"]`).value = tmpId;

            // Réindexer toutes les actions pour s'assurer que les numéros sont cohérents
            setTimeout(() => updateActionsIndexes(stepIndex), 0);
        }

        // Fonction pour ajouter un feedback
        function addFeedback(stepIndex, actionIndex) {
            const container = document.getElementById(`feedbacks-container-${stepIndex}-${actionIndex}`);
            const feedbackIndex = jsonData.process.steps[stepIndex].stepActions[actionIndex].actionFeedbacks.length;
            const feedbackDiv = document.createElement('div');
            feedbackDiv.className = 'array-item collapsed section-feedback';
            feedbackDiv.id = `feedback-${stepIndex}-${actionIndex}-${feedbackIndex}`;

            feedbackDiv.innerHTML = `
                <div class="array-item-header">
                    <button type="button" class="btn btn-collapse" onclick="toggleCollapse('feedback-${stepIndex}-${actionIndex}-${feedbackIndex}')">
                        ⇵ Réduire/Agrandir
                    </button>
                    <span class="array-item-title" id="feedback-title-display-${stepIndex}-${actionIndex}-${feedbackIndex}">Feedback ${feedbackIndex + 1}</span>
                    <div class="header-controls">
                        <button type="button" class="btn btn-remove" onclick="removeFeedback(${stepIndex}, ${actionIndex}, ${feedbackIndex})">
                            ✕ Supprimer
                        </button>
                        <button type="button" class="stage-item-btn feedback-move-up-btn" title="Monter" onclick="moveFeedbackInAction(${stepIndex}, ${actionIndex}, ${feedbackIndex}, -1)">▲</button>
                        <button type="button" class="stage-item-btn feedback-move-down-btn" title="Descendre" onclick="moveFeedbackInAction(${stepIndex}, ${actionIndex}, ${feedbackIndex}, 1)">▼</button>
                    </div>
                </div>

                <div class="collapsible-content">

                <input type="hidden" name="feedback[${stepIndex}][${actionIndex}][${feedbackIndex}].feedbackID" value="${feedbackIndex + 1}">
                <input type="hidden" name="feedback[${stepIndex}][${actionIndex}][${feedbackIndex}].feedbackPrefab" id="feedbackPrefab-${stepIndex}-${actionIndex}-${feedbackIndex}" value='[]'>

                <div style="margin-top: 16px; border: 1px solid var(--grey-mid); border-radius: 6px; padding: 14px 16px;">
                    <div class="indicator-grid" style="display: grid; grid-template-columns: 1.8fr 0.8fr 1.5fr; gap: 20px; margin-top: 0; align-items: flex-start;">
                        <div style="display: flex; flex-direction: column; gap: 8px; flex: 2;">
                            <label style="margin: 0;" title="Type de marqueur 3D affiché lors du feedback">Type d'indicateur <span class="icon-color">ℹ️</span></label>
                            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                                <button type="button" class="feedback-type-btn" data-type="zone" onclick="updateFeedbackType(${stepIndex}, ${actionIndex}, ${feedbackIndex}, 'zone')">Zone</button>
                                <button type="button" class="feedback-type-btn" data-type="niveau" onclick="updateFeedbackType(${stepIndex}, ${actionIndex}, ${feedbackIndex}, 'niveau')">Niveau</button>
                                <button type="button" class="feedback-type-btn" data-type="aplomb" onclick="updateFeedbackType(${stepIndex}, ${actionIndex}, ${feedbackIndex}, 'aplomb')">Aplomb</button>
                                <button type="button" class="feedback-type-btn" data-type="point" onclick="updateFeedbackType(${stepIndex}, ${actionIndex}, ${feedbackIndex}, 'point')">Point</button>
                            </div>
                            <div id="feedback-options-${stepIndex}-${actionIndex}-${feedbackIndex}" style="display: none; flex-wrap: wrap; gap: 25px; margin-top: 8px; margin-bottom: 0; align-items: flex-start;">
                                <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 8px;">
                                    <label style="margin: 0; font-size: 0.9em;">Direction</label>
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <button type="button" class="feedback-option-btn-small" data-option="in" onclick="updateFeedbackDirection(${stepIndex}, ${actionIndex}, ${feedbackIndex}, 'in')">In</button>
                                        <button type="button" class="feedback-option-btn-small" data-option="out" onclick="updateFeedbackDirection(${stepIndex}, ${actionIndex}, ${feedbackIndex}, 'out')">Out</button>
                                    </div>
                                </div>
                                <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 8px;">
                                    <label style="margin: 0; font-size: 0.9em;">Orientation</label>
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <button type="button" class="feedback-option-btn-small" data-option="vertical" onclick="updateFeedbackOrientation(${stepIndex}, ${actionIndex}, ${feedbackIndex}, 'vertical')">Vertical</button>
                                        <button type="button" class="feedback-option-btn-small" data-option="horizontal" onclick="updateFeedbackOrientation(${stepIndex}, ${actionIndex}, ${feedbackIndex}, 'horizontal')">Horizontal</button>
                                    </div>
                                </div>
                                <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 8px;">
                                    <label style="margin: 0; font-size: 0.9em;">Distance</label>
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <button type="button" class="feedback-option-btn-small" id="distance-btn-${stepIndex}-${actionIndex}-${feedbackIndex}" data-option="non" onclick="toggleFeedbackDistance(${stepIndex}, ${actionIndex}, ${feedbackIndex})">Non</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    <div class="scale-posrot-wrapper">
                        <div style="display: flex; flex-direction: column; gap: 8px; flex: 0.5;">
                            <label style="margin: 0;" title="Taille de l'indicateur (1 = taille normale)">Échelle <span class="icon-color">ℹ️</span></label>
                            <input type="number" name="feedback[${stepIndex}][${actionIndex}][${feedbackIndex}].feedbackPrefabScale" step="0.1" value="1" style="width: 70px !important; padding: 7px; border: 2px solid var(--input-border); border-radius: 5px; font-size: 0.9em;">
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 8px; flex: 1.5;">
                            <button type="button" class="feedback-type-btn" id="feedback-posrot-toggle-${stepIndex}-${actionIndex}-${feedbackIndex}" onclick="toggleFeedbackPosRot(${stepIndex}, ${actionIndex}, ${feedbackIndex})" style="margin: 0; font-weight: 400;">
                                <span class="desktop-inline">Position & rotation</span><span class="mobile-inline">Pos & Rot</span> ▼
                            </button>
                            <div id="feedback-posrot-content-${stepIndex}-${actionIndex}-${feedbackIndex}" style="display: none; flex-direction: column; gap: 12px;">
                                <label style="margin: 0;" title="Coordonnées 3D de placement de l'indicateur">Position <span class="icon-color">ℹ️</span></label>
                                <div class="pos-rot-inputs" style="display: flex; gap: 8px; align-items: center;">
                                    <label style="margin: 0; font-size: 0.85em;">X</label>
                                    <input type="number" name="feedback[${stepIndex}][${actionIndex}][${feedbackIndex}].feedbackPos.x" step="1" value="0" style="width: 60px; padding: 7px; border: 2px solid var(--input-border); border-radius: 5px; font-size: 0.9em;">
                                    <label style="margin: 0; font-size: 0.85em;">Y</label>
                                    <input type="number" name="feedback[${stepIndex}][${actionIndex}][${feedbackIndex}].feedbackPos.y" step="1" value="0" style="width: 60px; padding: 7px; border: 2px solid var(--input-border); border-radius: 5px; font-size: 0.9em;">
                                    <label style="margin: 0; font-size: 0.85em;">Z</label>
                                    <input type="number" name="feedback[${stepIndex}][${actionIndex}][${feedbackIndex}].feedbackPos.z" step="1" value="0" style="width: 60px; padding: 7px; border: 2px solid var(--input-border); border-radius: 5px; font-size: 0.9em;">
                                </div>
                                <label style="margin: 0;" title="Angles de rotation de l'indicateur (en degrés)">Rotation <span class="icon-color">ℹ️</span></label>
                                <div class="pos-rot-inputs" style="display: flex; gap: 8px; align-items: center;">
                                    <label style="margin: 0; font-size: 0.85em;">X</label>
                                    <input type="number" name="feedback[${stepIndex}][${actionIndex}][${feedbackIndex}].feedbackRot.x" step="any" value="0" style="width: 60px; padding: 7px; border: 2px solid var(--input-border); border-radius: 5px; font-size: 0.9em;">
                                    <label style="margin: 0; font-size: 0.85em;">Y</label>
                                    <input type="number" name="feedback[${stepIndex}][${actionIndex}][${feedbackIndex}].feedbackRot.y" step="any" value="0" style="width: 60px; padding: 7px; border: 2px solid var(--input-border); border-radius: 5px; font-size: 0.9em;">
                                    <label style="margin: 0; font-size: 0.85em;">Z</label>
                                    <input type="number" name="feedback[${stepIndex}][${actionIndex}][${feedbackIndex}].feedbackRot.z" step="any" value="0" style="width: 60px; padding: 7px; border: 2px solid var(--input-border); border-radius: 5px; font-size: 0.9em;">
                                </div>
                            </div>
                        </div>
                    </div>
                    </div>
                </div>

            `;

            container.appendChild(feedbackDiv);

            // Activer le drag & drop pour ce feedback
            setupFeedbackDragAndDrop(feedbackDiv, stepIndex, actionIndex);
            if (feedbackIndex === 0 || !container._dropHandler) {
                setupFeedbacksContainerDrop(stepIndex, actionIndex);
            }

            // Mise à jour dynamique du titre dans le header du feedback
            updateFeedbackDisplayTitle(stepIndex, actionIndex, feedbackIndex);

            if (!jsonData.process.steps[stepIndex].stepActions[actionIndex].actionFeedbacks) {
                jsonData.process.steps[stepIndex].stepActions[actionIndex].actionFeedbacks = [];
            }

            jsonData.process.steps[stepIndex].stepActions[actionIndex].actionFeedbacks.push({
                feedbackPrefab: [],
                feedbackPos: { x: 0, y: 0, z: 0 },
                feedbackRot: { x: 0, y: 0, z: 0 },
                feedbackPrefabScale: "1"
            });
        }

        // Fonctions pour gérer les boutons de feedback
        function updateFeedbackType(stepIndex, actionIndex, feedbackIndex, type) {
            const feedbackDiv = document.getElementById(`feedback-${stepIndex}-${actionIndex}-${feedbackIndex}`);
            if (!feedbackDiv) return;

            // Mettre à jour les boutons actifs
            const typeButtons = feedbackDiv.querySelectorAll('.feedback-type-btn');
            typeButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.type === type);
            });

            // Afficher/masquer les options selon le type
            const optionsDiv = document.getElementById(`feedback-options-${stepIndex}-${actionIndex}-${feedbackIndex}`);
            if (optionsDiv) {
                // Seul "point" affiche les options direction/orientation/distance
                optionsDiv.style.display = type === 'point' ? 'flex' : 'none';
            }

            // Construire et mettre à jour le prefab
            buildFeedbackPrefab(stepIndex, actionIndex, feedbackIndex);
        }

        function toggleFeedbackPosRot(stepIndex, actionIndex, feedbackIndex) {
            const content = document.getElementById(`feedback-posrot-content-${stepIndex}-${actionIndex}-${feedbackIndex}`);
            const toggleBtn = document.getElementById(`feedback-posrot-toggle-${stepIndex}-${actionIndex}-${feedbackIndex}`);
            if (!content || !toggleBtn) return;

            const isClosed = content.style.display === 'none' || content.style.display === '';
            content.style.display = isClosed ? 'flex' : 'none';
            const labelText = window.innerWidth <= 900 ? 'Pos & Rot' : 'Position & rotation';
            toggleBtn.textContent = isClosed ? `${labelText} ▲` : `${labelText} ▼`;
        }

        function updateFeedbackDirection(stepIndex, actionIndex, feedbackIndex, direction) {
            const feedbackDiv = document.getElementById(`feedback-${stepIndex}-${actionIndex}-${feedbackIndex}`);
            if (!feedbackDiv) return;

            const directionButtons = feedbackDiv.querySelectorAll('[data-option="in"], [data-option="out"]');
            directionButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.option === direction);
            });

            buildFeedbackPrefab(stepIndex, actionIndex, feedbackIndex);
        }

        function updateFeedbackOrientation(stepIndex, actionIndex, feedbackIndex, orientation) {
            const feedbackDiv = document.getElementById(`feedback-${stepIndex}-${actionIndex}-${feedbackIndex}`);
            if (!feedbackDiv) return;

            const orientationButtons = feedbackDiv.querySelectorAll('[data-option="vertical"], [data-option="horizontal"]');
            orientationButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.option === orientation);
            });

            buildFeedbackPrefab(stepIndex, actionIndex, feedbackIndex);
        }

        function toggleFeedbackDistance(stepIndex, actionIndex, feedbackIndex) {
            const btn = document.getElementById(`distance-btn-${stepIndex}-${actionIndex}-${feedbackIndex}`);
            if (!btn) return;

            // Basculer entre 'non' et 'oui'
            const currentValue = btn.dataset.option;
            const newValue = currentValue === 'non' ? 'oui' : 'non';
            btn.dataset.option = newValue;
            btn.textContent = newValue === 'non' ? 'Non' : 'Oui';

            // Ajouter la classe active quand c'est "Oui", la retirer sinon
            if (newValue === 'oui') {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }

            // Note: la distance n'est pas incluse dans le feedbackPrefab pour le moment
            buildFeedbackPrefab(stepIndex, actionIndex, feedbackIndex);
        }

        function updateFeedbackDistance(stepIndex, actionIndex, feedbackIndex, distance) {
            const btn = document.getElementById(`distance-btn-${stepIndex}-${actionIndex}-${feedbackIndex}`);
            if (!btn) return;

            btn.dataset.option = distance;
            btn.textContent = distance === 'non' ? 'Non' : 'Oui';

            // Ajouter la classe active quand c'est "Oui", la retirer sinon
            if (distance === 'oui') {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }

            buildFeedbackPrefab(stepIndex, actionIndex, feedbackIndex);
        }

        function buildFeedbackPrefab(stepIndex, actionIndex, feedbackIndex) {
            const feedbackDiv = document.getElementById(`feedback-${stepIndex}-${actionIndex}-${feedbackIndex}`);
            if (!feedbackDiv) return;

            // Récupérer les valeurs sélectionnées
            const type = feedbackDiv.querySelector('.feedback-type-btn.active')?.dataset.type || 'point';

            let prefabArray;

            // Seul "point" utilise direction/orientation/distance
            if (type === 'point') {
                const directionBtn = feedbackDiv.querySelector('[data-option="in"].active, [data-option="out"].active');
                const orientationBtn = feedbackDiv.querySelector('[data-option="vertical"].active, [data-option="horizontal"].active');
                const distanceBtn = document.getElementById(`distance-btn-${stepIndex}-${actionIndex}-${feedbackIndex}`);
                const hasDistance = distanceBtn?.dataset.option === 'oui';

                // Construire le tableau prefab: commencer avec le type
                prefabArray = [type];

                // N'ajouter direction et orientation que si elles ont été explicitement sélectionnées
                if (directionBtn) {
                    prefabArray.push(directionBtn.dataset.option);
                }
                if (orientationBtn) {
                    prefabArray.push(orientationBtn.dataset.option);
                }
                if (hasDistance) {
                    prefabArray.push('distance');
                }
            } else {
                // Pour zone, niveau, aplomb : juste le nom du type
                prefabArray = [type];
            }

            // Mettre à jour l'input hidden (on stocke le tableau en JSON)
            const hiddenInput = document.getElementById(`feedbackPrefab-${stepIndex}-${actionIndex}-${feedbackIndex}`);
            if (hiddenInput) {
                hiddenInput.value = JSON.stringify(prefabArray);
            }

            // Mettre à jour le JSON
            if (jsonData.process.steps[stepIndex]?.stepActions[actionIndex]?.actionFeedbacks[feedbackIndex]) {
                jsonData.process.steps[stepIndex].stepActions[actionIndex].actionFeedbacks[feedbackIndex].feedbackPrefab = prefabArray;
            }

            // Mettre à jour le titre affiché
            updateFeedbackDisplayTitle(stepIndex, actionIndex, feedbackIndex);
        }

        function updateFeedbackDisplayTitle(stepIndex, actionIndex, feedbackIndex) {
            const display = document.getElementById(`feedback-title-display-${stepIndex}-${actionIndex}-${feedbackIndex}`);
            const hiddenInput = document.getElementById(`feedbackPrefab-${stepIndex}-${actionIndex}-${feedbackIndex}`);

            if (display && hiddenInput) {
                try {
                    const prefabArray = JSON.parse(hiddenInput.value);
                    // Formater: ["point", "out", "horizontal"] -> "Point | Out | Horizontal"
                    const formattedPrefab = prefabArray.map(val => val.charAt(0).toUpperCase() + val.slice(1)).join(' | ');
                    display.innerHTML = `<b>Indicateur ${feedbackIndex + 1} | </b>${formattedPrefab}`;
                } catch (e) {
                    // Fallback si le parsing échoue
                    display.innerHTML = `<b>Feedback ${feedbackIndex + 1}</b>`;
                }
            }
        }

        function moveActionInStep(stepIndex, actionIndex, direction) {
            const actionsContainer = document.getElementById(`actions-container-${stepIndex}`);
            if (!actionsContainer) return;

            const actions = Array.from(actionsContainer.children);
            const currentIndex = actions.findIndex(action => action.id === `action-${stepIndex}-${actionIndex}`);
            if (currentIndex < 0) return;

            const targetIndex = currentIndex + direction;
            if (targetIndex < 0 || targetIndex >= actions.length) return;

            const currentAction = actions[currentIndex];
            if (direction < 0) {
                actionsContainer.insertBefore(currentAction, actions[targetIndex]);
            } else {
                actionsContainer.insertBefore(currentAction, actions[targetIndex].nextSibling);
            }

            reorderActionsInModel(stepIndex);
            updateActionsIndexes(stepIndex);
        }

        function moveFeedbackInAction(stepIndex, actionIndex, feedbackIndex, direction) {
            const feedbacksContainer = document.getElementById(`feedbacks-container-${stepIndex}-${actionIndex}`);
            if (!feedbacksContainer) return;

            const feedbacks = Array.from(feedbacksContainer.children);
            const currentIndex = feedbacks.findIndex(feedback => feedback.id === `feedback-${stepIndex}-${actionIndex}-${feedbackIndex}`);
            if (currentIndex < 0) return;

            const targetIndex = currentIndex + direction;
            if (targetIndex < 0 || targetIndex >= feedbacks.length) return;

            const currentFeedback = feedbacks[currentIndex];
            if (direction < 0) {
                feedbacksContainer.insertBefore(currentFeedback, feedbacks[targetIndex]);
            } else {
                feedbacksContainer.insertBefore(currentFeedback, feedbacks[targetIndex].nextSibling);
            }

            reorderFeedbacksInModel(stepIndex, actionIndex);
            updateFeedbacksIndexes(stepIndex, actionIndex);
        }

        // Fonction pour ajouter un stage
        function addStage() {
            const container = document.getElementById('stages-container');
            const stageIndex = jsonData.process.stages.length;
            const stageDiv = document.createElement('div');
            stageDiv.className = 'array-item collapsed section-stage';
            stageDiv.id = `stage-${stageIndex}`;

            stageDiv.innerHTML = `
                <div class="array-item-header">
                    <button type="button" class="btn btn-collapse" onclick="toggleCollapse('stage-${stageIndex}')">
                        ⇵ Réduire/Agrandir
                    </button>
                    <span class="array-item-title" id="stage-title-display-${stageIndex}">Procédure ${stageIdCounter}</span>
                    <div>
                        <button type="button" class="btn btn-remove" onclick="removeStage(${stageIndex})">
                            ✕ Supprimer
                        </button>
                    </div>
                </div>
                <div class="collapsible-content">
                    <input type="hidden" name="stage[${stageIndex}].stageID" value="${stageIdCounter}">
                    
                    <div class="form-row" style="margin-top: 20px;">
                        <div class="form-group">
                            <label title="Nom de la procédure affiché dans l'interface">Nom de la procédure <span class="icon-color">ℹ️</span></label>
                            <input type="text" name="stage[${stageIndex}].stageTitle" placeholder="Exemple : Procédure 1 - Préparation">
                        </div>
                        <div class="form-group">
                            <label title="Description détaillée du contenu de la procédure">Description de la procédure<span class="icon-color"> ℹ️</span></label>
                            <textarea name="stage[${stageIndex}].stageDesc" placeholder="Détails de la procédure..."></textarea>
                        </div>
                        <div class="form-group">
                            <label title="ID de la procédure qui doit être terminée avant celle-ci">Requiert la procédure (ID) <span class="icon-color">ℹ️</span></label>
                            <input type="number" name="stage[${stageIndex}].stageRequiresStageID" min="0" value="0">
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label title="Sélectionnez et ordonnez les étapes qui composent cette procédure">Chemin des étapes <span class="icon-color">ℹ️</span></label>
                            <input type="hidden" name="stage[${stageIndex}].stagePath" id="stagePath-input-${stageIndex}">
                            <div class="stage-path-builder" data-stage-index="${stageIndex}">
                                <div class="stage-path-columns">
                                    <div class="stage-path-column">
                                        <div class="stage-path-title">Étapes disponibles</div>
                                        <div class="stage-step-list stage-step-list-available" id="stageAvailableSteps-${stageIndex}">
                                            <!-- Étapes disponibles injectées en JS -->
                                        </div>
                                    </div>
                                    <div class="stage-path-column">
                                        <div class="stage-path-title">Chemin de la procédure (glisser-déposer ou boutons ▲▼ sur mobile)</div>
                                        <div class="stage-step-list stage-step-list-selected" id="stageSelectedSteps-${stageIndex}">
                                            <!-- Chemin du stage injecté en JS -->
                                        </div>
                                        <div class="stage-path-help">
                                            Cliquez sur une étape disponible pour l'ajouter. Sur mobile, utilisez ▲▼ pour l'ordre et ✕ pour retirer.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            container.appendChild(stageDiv);

            // Mise à jour dynamique du titre dans le header du stage
            var stageDisplay = document.getElementById(`stage-title-display-${stageIndex}`);
            var stageInput = document.querySelector(`input[name="stage[${stageIndex}].stageTitle"]`);
            if (stageDisplay && stageInput) {
                // Initialisation à la création
                stageDisplay.innerHTML = `<b>Procédure ${stageIndex + 1}${stageInput.value ? ' | </b>' + stageInput.value : ''}`;
                // Mise à jour dynamique
                stageInput.addEventListener('input', function (e) {
                    stageDisplay.innerHTML = `<b>Procédure ${stageIndex + 1}${e.target.value ? ' | </b>' + e.target.value : ''}`;
                    // Synchronise le modèle si besoin
                    jsonData.process.stages[stageIndex].stageTitle = e.target.value;
                });
            }

            // Ajouter le stage au modèle JSON
            jsonData.process.stages.push({
                stageID: stageIdCounter++,
                stageTitle: "",
                stageDesc: "",
                stageRequiresStageID: "",
                stagePath: ""
            });

            // Initialiser l'UI de construction du chemin des étapes pour ce stage
            initStagePathBuilder(stageIndex);
        }

        // Fonctions de suppression
        function removeStep(index) {
            if (!confirm('⚠️ Voulez-vous vraiment supprimer cette étape ?')) return;

            // Capture l'état complet via le formulaire pour conserver toutes les actions/feedbacks
            const data = collectFormData();

            // Supprime dans ce modèle, réindexe les stepID
            const removedStep = data.process.steps[index];
            if (!removedStep) return;
            const removedIdNum = parseInt(removedStep.stepID) || (index + 1);
            data.process.steps.splice(index, 1);

            for (let i = 0; i < data.process.steps.length; i++) {
                data.process.steps[i].stepID = i + 1;
            }

            // Met à jour les stagePath: retire l'ID supprimé et décrémente ceux supérieurs
            data.process.stages = (data.process.stages || []).map(stage => {
                const parts = (stage.stagePath || '').split('.').filter(Boolean);
                const remapped = parts
                    .filter(id => parseInt(id) !== removedIdNum)
                    .map(id => {
                        const n = parseInt(id);
                        return String(n > removedIdNum ? n - 1 : n);
                    });
                return { ...stage, stagePath: remapped.join('.') };
            });

            // Avant de recharger, synchronise les champs généraux (procédure/settings) saisis par l'utilisateur
            jsonData = data;
            syncTopLevelToModelFromDOM();
            // Recharge proprement l'UI depuis le modèle pour garder les bonnes données et écouteurs
            loadDataToForm(jsonData);
            showMessage('Étape supprimée et réindexée');
        }

        function getExpandedStates() {
            const states = [];
            document.querySelectorAll('.array-item:not(.collapsed)').forEach(elem => {
                if (elem.id) {
                    states.push(elem.id);
                }
            });
            return states;
        }

        function restoreExpandedStates(states) {
            states.forEach(id => {
                const elem = document.getElementById(id);
                if (elem) {
                    elem.classList.remove('collapsed');
                    if (elem.classList.contains('section-step') || elem.classList.contains('section-action')) {
                        elem.draggable = false;
                    }
                }
            });
        }

        function duplicateStep(index) {
            const data = collectFormData();
            const sourceStep = data.process.steps[index];
            if (!sourceStep) return;

            const expandedStates = getExpandedStates();
            // Si l'étape source était ouverte, on ouvre aussi la copie
            const sourceStepElement = document.getElementById(`step-${index}`);
            if (sourceStepElement && !sourceStepElement.classList.contains('collapsed')) {
                expandedStates.push(`step-${index + 1}`);
            }

            const duplicatedStep = JSON.parse(JSON.stringify(sourceStep));
            const sourceStepId = parseInt(sourceStep.stepID) || (index + 1);

            data.process.steps.splice(index + 1, 0, duplicatedStep);

            for (let i = 0; i < data.process.steps.length; i++) {
                data.process.steps[i].stepID = i + 1;
            }

            data.process.stages = (data.process.stages || []).map(stage => {
                const parts = (stage.stagePath || '').split('.').filter(Boolean);
                const remapped = parts.map(id => {
                    const n = parseInt(id);
                    if (Number.isNaN(n)) return id;
                    return String(n > sourceStepId ? n + 1 : n);
                });
                return { ...stage, stagePath: remapped.join('.') };
            });

            jsonData = data;
            syncTopLevelToModelFromDOM();
            loadDataToForm(jsonData);

            restoreExpandedStates(expandedStates);
            showMessage('Étape dupliquée et réindexée');
        }

        // Fonction pour dupliquer une action
        function duplicateAction(stepIndex, actionIndex) {
            const data = collectFormData();
            const sourceAction = data.process.steps[stepIndex]?.stepActions[actionIndex];
            if (!sourceAction) return;

            const expandedStates = getExpandedStates();
            // Si l'action source était ouverte, on ouvre aussi la copie
            const sourceActionElement = document.getElementById(`action-${stepIndex}-${actionIndex}`);
            if (sourceActionElement && !sourceActionElement.classList.contains('collapsed')) {
                expandedStates.push(`action-${stepIndex}-${actionIndex + 1}`);
            }

            const duplicatedAction = JSON.parse(JSON.stringify(sourceAction));

            data.process.steps[stepIndex].stepActions.splice(actionIndex + 1, 0, duplicatedAction);

            jsonData = data;
            syncTopLevelToModelFromDOM();
            loadDataToForm(jsonData);

            restoreExpandedStates(expandedStates);
            showMessage('Action dupliquée');
        }

        //Fonction pour supprimer une action (mise à jour DOM + modèle, sans reload global)
        function removeAction(stepIndex, actionIndex) {
            if (!confirm('⚠️ Voulez-vous vraiment supprimer cette action ?')) return;
            if (!jsonData.process.steps[stepIndex]) return;
            jsonData.process.steps[stepIndex].stepActions.splice(actionIndex, 1);
            const el = document.getElementById(`action-${stepIndex}-${actionIndex}`);
            if (el) el.remove();
            updateActionsIndexes(stepIndex);
            showMessage('Action supprimée');
        }

        //Fonction pour supprimer un feedback (mise à jour DOM + modèle, sans reload global)
        function removeFeedback(stepIndex, actionIndex, feedbackIndex) {
            if (!confirm('⚠️ Voulez-vous vraiment supprimer cet indicateur ?')) return;
            const action = jsonData.process.steps[stepIndex]?.stepActions[actionIndex];
            if (!action) return;
            action.actionFeedbacks.splice(feedbackIndex, 1);
            const container = document.getElementById(`feedbacks-container-${stepIndex}-${actionIndex}`);
            if (container && container.children[feedbackIndex]) {
                container.children[feedbackIndex].remove();
            }
            updateFeedbacksIndexes(stepIndex, actionIndex);
            showMessage('Indicateur supprimé');
        }

        //Fonction pour supprimer un stage
        function removeStage(index) {
            if (confirm('⚠️ Voulez-vous vraiment supprimer ce stage ?')) {
                jsonData.process.stages.splice(index, 1);
                document.getElementById('stages-container').children[index].remove();
                updateStagesIndexes();
            }
        }


        // Réindexe toutes les étapes
        function updateStepsIndexes() {
            const steps = document.getElementById('steps-container').children;
            for (let i = 0; i < steps.length; i++) {
                const step = steps[i];
                step.id = `step-${i}`;

                // Met à jour l'input stepID caché
                const hid = step.querySelector('input[name^="step["][name$="].stepID"]');
                if (hid) hid.value = i + 1;
                if (jsonData.process.steps[i]) jsonData.process.steps[i].stepID = i + 1;

                // Met à jour les handlers du header (collapse et remove)
                const header = step.querySelector('.array-item-header');
                if (header) {
                    const collapseBtn = header.querySelector('.btn.btn-collapse');
                    if (collapseBtn) {
                        collapseBtn.setAttribute('onclick', `toggleCollapse('step-${i}')`);
                    }
                    const removeBtn = header.querySelector('.btn.btn-remove');
                    if (removeBtn) {
                        removeBtn.setAttribute('onclick', `removeStep(${i})`);
                    }
                }

                // Met à jour les noms des champs de l'étape au nouvel index
                const renameForStep = (elem) => {
                    const name = elem.getAttribute('name');
                    if (!name) return;
                    let newName = name
                        .replace(/step\[\d+\]/g, `step[${i}]`)
                        .replace(/action\[\d+\]\[(\d+)\]/g, `action[${i}][$1]`)
                        .replace(/feedback\[\d+\]\[\d+\]\[(\d+)\]/g, `feedback[${i}][$1][$2]`);
                    elem.setAttribute('name', newName);
                };
                step.querySelectorAll('input[name], textarea[name], select[name]').forEach(renameForStep);

                // Titre dynamique (met à jour l'ID et le contenu affiché avec le nouveau numéro)
                const title = step.querySelector(`[id^="step-title-display-"]`);
                if (title) {
                    title.id = `step-title-display-${i}`;
                    const inputTitle = step.querySelector(`input[name^="step["][name$="].stepTitle"]`);
                    const value = inputTitle ? inputTitle.value : '';
                    title.innerHTML = `ID${i + 1} | ${value ? escapeHtml(value) : 'Étape <b>sans nom</b>'}`;
                }

                // Met à jour les IDs des inputs de fichiers et leurs boutons
                const stepImgFile = step.querySelector(`input[type="file"][id^="stepImg-"]`);
                if (stepImgFile) {
                    stepImgFile.id = `stepImg-${i}`;
                    const stepImgBtn = step.querySelector(`button[onclick*="stepImg-"]`);
                    if (stepImgBtn) {
                        stepImgBtn.setAttribute('onclick', `document.getElementById('stepImg-${i}').click()`);
                    }
                }

                const stepHologramFile = step.querySelector(`input[type="file"][id^="stepHologram-"]`);
                if (stepHologramFile) {
                    stepHologramFile.id = `stepHologram-${i}`;
                    const stepHologramBtn = step.querySelector(`button[onclick*="stepHologram-"]`);
                    if (stepHologramBtn) {
                        stepHologramBtn.setAttribute('onclick', `document.getElementById('stepHologram-${i}').click()`);
                    }
                }

                const stepAudioFile = step.querySelector(`input[type="file"][id^="stepAudio-"]`);
                if (stepAudioFile) {
                    stepAudioFile.id = `stepAudio-${i}`;
                    const stepAudioBtn = step.querySelector(`button[onclick*="stepAudio-"]`);
                    if (stepAudioBtn) {
                        stepAudioBtn.setAttribute('onclick', `document.getElementById('stepAudio-${i}').click()`);
                    }
                }

                // Met à jour le bouton "Ajouter une action"
                const addActionBtn = step.querySelector('button[onclick^="addAction("]');
                if (addActionBtn) {
                    addActionBtn.setAttribute('onclick', `addAction(${i})`);
                }

                // Met à jour les IDs des inputs cachés d'hologramme
                const holoPosX = step.querySelector(`input[id^="stepHologramOffsetPosXInput-"]`);
                if (holoPosX) holoPosX.id = `stepHologramOffsetPosXInput-${i}`;

                const holoPosY = step.querySelector(`input[id^="stepHologramOffsetPosYInput-"]`);
                if (holoPosY) holoPosY.id = `stepHologramOffsetPosYInput-${i}`;

                const holoPosZ = step.querySelector(`input[id^="stepHologramOffsetPosZInput-"]`);
                if (holoPosZ) holoPosZ.id = `stepHologramOffsetPosZInput-${i}`;

                const holoRotX = step.querySelector(`input[id^="stepHologramOffsetRotXInput-"]`);
                if (holoRotX) holoRotX.id = `stepHologramOffsetRotXInput-${i}`;

                const holoRotY = step.querySelector(`input[id^="stepHologramOffsetRotYInput-"]`);
                if (holoRotY) holoRotY.id = `stepHologramOffsetRotYInput-${i}`;

                const holoRotZ = step.querySelector(`input[id^="stepHologramOffsetRotZInput-"]`);
                if (holoRotZ) holoRotZ.id = `stepHologramOffsetRotZInput-${i}`;

                // Actions container
                const actionsContainer = step.querySelector(`[id^="actions-container-"]`);
                if (actionsContainer) {
                    actionsContainer.id = `actions-container-${i}`;
                    updateActionsIndexes(i);
                }

                // Réactiver le drag & drop pour ce step après réindexation
                // setupStepDragAndDrop(step); // Drag & drop désactivé pour les étapes
            }
            // Rafraîchit les builders de chemin des stages pour refléter les nouveaux IDs
            refreshAllStagePathBuilders();
        }

        // Réindexe toutes les actions d'une étape
        function updateActionsIndexes(stepIndex) {
            const actionsContainer = document.getElementById(`actions-container-${stepIndex}`);
            if (!actionsContainer) return;
            const actions = actionsContainer.children;
            for (let j = 0; j < actions.length; j++) {
                const action = actions[j];
                action.id = `action-${stepIndex}-${j}`;

                // Met à jour les noms pour le nouvel index d'action
                action.querySelectorAll('input[name], textarea[name], select[name]').forEach(elem => {
                    const name = elem.getAttribute('name');
                    if (!name) return;
                    let newName = name
                        .replace(/action\[\d+\]\[\d+\]/g, `action[${stepIndex}][${j}]`)
                        .replace(/feedback\[\d+\]\[\d+\]\[(\d+)\]/g, `feedback[${stepIndex}][${j}][$1]`);
                    elem.setAttribute('name', newName);
                });

                // Met à jour les handlers du header (collapse et remove)
                const header = action.querySelector('.array-item-header');
                if (header) {
                    const collapseBtn = header.querySelector('.btn.btn-collapse');
                    if (collapseBtn) {
                        collapseBtn.setAttribute('onclick', `toggleCollapse('action-${stepIndex}-${j}')`);
                    }
                    const duplicateBtn = header.querySelector('.action-duplicate-btn');
                    if (duplicateBtn) {
                        duplicateBtn.setAttribute('onclick', `duplicateAction(${stepIndex}, ${j})`);
                    }
                    const removeBtn = header.querySelector('.btn.btn-remove');
                    if (removeBtn) {
                        removeBtn.setAttribute('onclick', `removeAction(${stepIndex}, ${j})`);
                    }
                    const moveUpBtn = header.querySelector('.action-move-up-btn');
                    if (moveUpBtn) {
                        moveUpBtn.setAttribute('onclick', `moveActionInStep(${stepIndex}, ${j}, -1)`);
                    }
                    const moveDownBtn = header.querySelector('.action-move-down-btn');
                    if (moveDownBtn) {
                        moveDownBtn.setAttribute('onclick', `moveActionInStep(${stepIndex}, ${j}, 1)`);
                    }
                }

                // Titre dynamique (met à jour l'ID et le contenu affiché avec le nouveau numéro)
                const title = action.querySelector(`[id^="action-title-display-"]`);
                if (title) {
                    title.id = `action-title-display-${stepIndex}-${j}`;
                    const inputTitle = action.querySelector(`input[name$=".actionTitle"]`);
                    const value = inputTitle ? inputTitle.value : '';
                    title.innerHTML = `ID${j + 1} | ${value ? escapeHtml(value) : 'Action <b>sans nom</b>'}`;
                }
                // Feedbacks container
                const feedbacksContainer = action.querySelector(`[id^="feedbacks-container-"]`);
                if (feedbacksContainer) {
                    feedbacksContainer.id = `feedbacks-container-${stepIndex}-${j}`;
                    updateFeedbacksIndexes(stepIndex, j);
                }

                // Bouton "+ Ajouter un feedback" doit pointer vers les nouveaux index
                const addFbBtn = action.querySelector('button[onclick^="addFeedback("]');
                if (addFbBtn) {
                    addFbBtn.setAttribute('onclick', `addFeedback(${stepIndex}, ${j})`);
                }

                // Réactiver le drag & drop pour cette action après réindexation
                const tmpIdInput = action.querySelector(`input[name^="action["][name$="].actionID"]`);
                const actionData = jsonData.process.steps[stepIndex]?.stepActions[j];
                if (tmpIdInput) {
                    tmpIdInput.value = actionData && actionData.actionID ? actionData.actionID : j + 1;
                }
                setupActionDragAndDrop(action, stepIndex);
            }

            // Reconfigurer le drop sur le conteneur après réindexation
            setupActionsContainerDrop(stepIndex);
        }

        // Réindexe tous les feedbacks d'une action
        function updateFeedbacksIndexes(stepIndex, actionIndex) {
            const feedbacksContainer = document.getElementById(`feedbacks-container-${stepIndex}-${actionIndex}`);
            if (!feedbacksContainer) return;
            const feedbacks = feedbacksContainer.children;
            for (let k = 0; k < feedbacks.length; k++) {
                const feedback = feedbacks[k];
                feedback.id = `feedback-${stepIndex}-${actionIndex}-${k}`;

                // Met à jour les noms pour le nouvel index de feedback
                feedback.querySelectorAll('input[name], textarea[name], select[name]').forEach(elem => {
                    const name = elem.getAttribute('name');
                    if (!name) return;
                    let newName = name.replace(/feedback\[\d+\]\[\d+\]\[\d+\]/g, `feedback[${stepIndex}][${actionIndex}][${k}]`);
                    elem.setAttribute('name', newName);
                });

                // Met à jour l'ID interne pour le modèle si présent
                const idInput = feedback.querySelector('input[name$=".feedbackID"]');
                if (idInput) {
                    idInput.value = k + 1;
                }

                // Met à jour les handlers du header (collapse et remove)
                const header = feedback.querySelector('.array-item-header');
                if (header) {
                    const collapseBtn = header.querySelector('.btn.btn-collapse');
                    if (collapseBtn) {
                        collapseBtn.setAttribute('onclick', `toggleCollapse('feedback-${stepIndex}-${actionIndex}-${k}')`);
                    }
                    const removeBtn = header.querySelector('.btn.btn-remove');
                    if (removeBtn) {
                        removeBtn.setAttribute('onclick', `removeFeedback(${stepIndex}, ${actionIndex}, ${k})`);
                    }
                    const moveUpBtn = header.querySelector('.feedback-move-up-btn');
                    if (moveUpBtn) {
                        moveUpBtn.setAttribute('onclick', `moveFeedbackInAction(${stepIndex}, ${actionIndex}, ${k}, -1)`);
                    }
                    const moveDownBtn = header.querySelector('.feedback-move-down-btn');
                    if (moveDownBtn) {
                        moveDownBtn.setAttribute('onclick', `moveFeedbackInAction(${stepIndex}, ${actionIndex}, ${k}, 1)`);
                    }
                }

                // Titre dynamique et input hidden prefab
                const title = feedback.querySelector(`[id^="feedback-title-display-"]`);
                const hiddenPrefab = feedback.querySelector(`input[id^="feedbackPrefab-"]`);

                if (title) {
                    title.id = `feedback-title-display-${stepIndex}-${actionIndex}-${k}`;
                }

                if (hiddenPrefab) {
                    hiddenPrefab.id = `feedbackPrefab-${stepIndex}-${actionIndex}-${k}`;
                }

                // Mettre à jour l'ID de la div des options
                const optionsDiv = feedback.querySelector(`[id^="feedback-options-"]`);
                if (optionsDiv) {
                    optionsDiv.id = `feedback-options-${stepIndex}-${actionIndex}-${k}`;
                }

                // Mettre à jour l'ID et l'action du menu Position & rotation
                const posRotToggle = feedback.querySelector(`[id^="feedback-posrot-toggle-"]`);
                if (posRotToggle) {
                    posRotToggle.id = `feedback-posrot-toggle-${stepIndex}-${actionIndex}-${k}`;
                    posRotToggle.setAttribute('onclick', `toggleFeedbackPosRot(${stepIndex}, ${actionIndex}, ${k})`);
                }

                const posRotContent = feedback.querySelector(`[id^="feedback-posrot-content-"]`);
                if (posRotContent) {
                    posRotContent.id = `feedback-posrot-content-${stepIndex}-${actionIndex}-${k}`;
                }

                // Met à jour tous les boutons onclick pour utiliser les nouveaux indices
                feedback.querySelectorAll('.feedback-type-btn[data-type]').forEach(btn => {
                    const type = btn.dataset.type;
                    btn.setAttribute('onclick', `updateFeedbackType(${stepIndex}, ${actionIndex}, ${k}, '${type}')`);
                });

                feedback.querySelectorAll('.feedback-option-btn-small[data-option="in"], .feedback-option-btn-small[data-option="out"]').forEach(btn => {
                    const direction = btn.dataset.option;
                    btn.setAttribute('onclick', `updateFeedbackDirection(${stepIndex}, ${actionIndex}, ${k}, '${direction}')`);
                });

                feedback.querySelectorAll('.feedback-option-btn-small[data-option="vertical"], .feedback-option-btn-small[data-option="horizontal"]').forEach(btn => {
                    const orientation = btn.dataset.option;
                    btn.setAttribute('onclick', `updateFeedbackOrientation(${stepIndex}, ${actionIndex}, ${k}, '${orientation}')`);
                });

                // Mettre à jour le bouton distance
                const distanceBtn = feedback.querySelector(`[id^="distance-btn-"]`);
                if (distanceBtn) {
                    distanceBtn.id = `distance-btn-${stepIndex}-${actionIndex}-${k}`;
                    distanceBtn.setAttribute('onclick', `toggleFeedbackDistance(${stepIndex}, ${actionIndex}, ${k})`);
                }

                // Mettre à jour le titre affiché
                updateFeedbackDisplayTitle(stepIndex, actionIndex, k);

                // Réactive le drag & drop sur ce feedback au nouvel index
                setupFeedbackDragAndDrop(feedback, stepIndex, actionIndex);
            }

            // S'assure que le conteneur a bien ses handlers après réindexation
            setupFeedbacksContainerDrop(stepIndex, actionIndex);
        }

        // Réindexe tous les stages
        function updateStagesIndexes() {
            const stages = document.getElementById('stages-container').children;
            for (let i = 0; i < stages.length; i++) {
                const stage = stages[i];
                stage.id = `stage-${i}`;

                // Met à jour le stageID caché et le modèle
                const hid = stage.querySelector('input[name^="stage["][name$="].stageID"]');
                if (hid) hid.value = i + 1;
                if (jsonData.process.stages[i]) jsonData.process.stages[i].stageID = i + 1;

                // Renomme tous les champs pour refléter le nouvel index de stage
                stage.querySelectorAll('input[name], textarea[name], select[name]').forEach(elem => {
                    const name = elem.getAttribute('name');
                    if (!name) return;
                    const newName = name.replace(/stage\[\d+\]/g, `stage[${i}]`);
                    elem.setAttribute('name', newName);
                });

                // Met à jour les IDs utilisés par le path builder
                const hiddenPath = stage.querySelector(`[id^="stagePath-input-"]`);
                if (hiddenPath) hiddenPath.id = `stagePath-input-${i}`;
                const avail = stage.querySelector(`[id^="stageAvailableSteps-"]`);
                if (avail) avail.id = `stageAvailableSteps-${i}`;
                const selected = stage.querySelector(`[id^="stageSelectedSteps-"]`);
                if (selected) selected.id = `stageSelectedSteps-${i}`;

                // Met à jour les handlers du header (collapse et remove)
                const header = stage.querySelector('.array-item-header');
                if (header) {
                    const collapseBtn = header.querySelector('.btn.btn-collapse');
                    if (collapseBtn) collapseBtn.setAttribute('onclick', `toggleCollapse('stage-${i}')`);
                    const removeBtn = header.querySelector('.btn.btn-remove');
                    if (removeBtn) removeBtn.setAttribute('onclick', `removeStage(${i})`);
                }

                // Titre dynamique (ID + texte affiché avec le nouveau numéro) + rebind oninput
                const title = stage.querySelector(`[id^="stage-title-display-"]`);
                const inputTitle = stage.querySelector(`input[name^="stage["][name$="].stageTitle"]`);
                if (title) {
                    title.id = `stage-title-display-${i}`;
                    const value = inputTitle ? inputTitle.value : '';
                    title.innerHTML = `<b>Procédure ${i + 1}${value ? ' | </b>' + value : ''}`;
                }
                if (inputTitle && title) {
                    inputTitle.oninput = function (e) {
                        title.innerHTML = `<b>Procédure ${i + 1}${e.target.value ? ' | </b>' + e.target.value : ''}`;
                        if (jsonData.process.stages[i]) {
                            jsonData.process.stages[i].stageTitle = e.target.value;
                        }
                    };
                }
            }
            // Rafraîchit les builders de chemins de stage pour refléter les nouveaux IDs
            refreshAllStagePathBuilders();
        }

        // Retourne le prochain actionID pour l'action courante
        function generateTmpId(stepIndex, actionIndex) {
            const action = jsonData.process.steps[stepIndex].stepActions[actionIndex];
            if (!action || !action.actionFeedbacks) return 1;
            return action.actionFeedbacks.length + 1;
        }

        // Collecter toutes les données du formulaire
        function collectFormData() {
            const formData = new FormData(document.getElementById('jsonForm'));
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
                        // Fin de modification

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
                    steps: [],
                    stages: []
                }
            };

            // Collecter les étapes
            const stepsContainer = document.getElementById('steps-container');
            for (let i = 0; i < stepsContainer.children.length; i++) {
                const step = {
                    stepID: parseInt(document.querySelector(`input[name="step[${i}].stepID"]`).value) || 0,
                    stepTitle: document.querySelector(`input[name="step[${i}].stepTitle"]`).value,
                    stepDesc: document.querySelector(`textarea[name="step[${i}].stepDesc"]`).value,
                    stepImg: document.querySelector(`input[name="step[${i}].stepImg"]`).value,
                    stepHologram: document.querySelector(`input[name="step[${i}].stepHologram"]`).value,
                    stepHologramOffsetPos: {
                        x: parseInt(document.querySelector(`input[name="step[${i}].stepHologramOffsetPos.x"]`).value) || 0,
                        y: parseInt(document.querySelector(`input[name="step[${i}].stepHologramOffsetPos.y"]`).value) || 0,
                        z: parseInt(document.querySelector(`input[name="step[${i}].stepHologramOffsetPos.z"]`).value) || 0
                    },
                    stepHologramOffsetRot: {
                        x: parseInt(document.querySelector(`input[name="step[${i}].stepHologramOffsetRot.x"]`).value) || 0,
                        y: parseInt(document.querySelector(`input[name="step[${i}].stepHologramOffsetRot.y"]`).value) || 0,
                        z: parseInt(document.querySelector(`input[name="step[${i}].stepHologramOffsetRot.z"]`).value) || 0
                    },
                    stepHologramScale: document.querySelector(`input[name="step[${i}].stepHologramScale"]`).value,
                    stepHologramInteractable: document.querySelector(`input[name="step[${i}].stepHologramInteractable"]`).checked,
                    stepHologramCalibrate: document.querySelector(`input[name="step[${i}].stepHologramCalibrate"]`).checked,
                    stepAudioText: document.querySelector(`textarea[name="step[${i}].stepAudioText"]`).value,
                    stepAudio: document.querySelector(`input[name="step[${i}].stepAudio"]`).value,
                    stepNote: document.querySelector(`input[name="step[${i}].stepNote"]`).value,
                    stepActions: []
                };

                // Collecter les actions de cette étape
                const actionsContainer = document.getElementById(`actions-container-${i}`);
                if (actionsContainer) {
                    for (let j = 0; j < actionsContainer.children.length; j++) {
                        const actionDiv = actionsContainer.children[j];

                        const action = {
                            actionID: j + 1,
                            actionTitle: actionDiv.querySelector(`input[name$=".actionTitle"]`)?.value || "",
                            actionDesc: actionDiv.querySelector(`textarea[name$=".actionDesc"]`)?.value || "",
                            actionImg: actionDiv.querySelector(`input[name$=".actionImg"]`)?.value || "",
                            feedbackItemTemplateID: parseInt(actionDiv.querySelector(`input[name$=".feedbackItemTemplateID"]`)?.value) || 0,
                            actionHologram: actionDiv.querySelector(`input[name$=".actionHologram"]`)?.value || "",
                            actionHologramOffsetPos: {
                                x: parseInt(actionDiv.querySelector(`input[name$=".actionHologramOffsetPos.x"]`)?.value) || 0,
                                y: parseInt(actionDiv.querySelector(`input[name$=".actionHologramOffsetPos.y"]`)?.value) || 0,
                                z: parseInt(actionDiv.querySelector(`input[name$=".actionHologramOffsetPos.z"]`)?.value) || 0
                            },
                            actionHologramOffsetRot: {
                                x: parseInt(actionDiv.querySelector(`input[name$=".actionHologramOffsetRot.x"]`)?.value) || 0,
                                y: parseInt(actionDiv.querySelector(`input[name$=".actionHologramOffsetRot.y"]`)?.value) || 0,
                                z: parseInt(actionDiv.querySelector(`input[name$=".actionHologramOffsetRot.z"]`)?.value) || 0
                            },
                            actionAudioText: actionDiv.querySelector(`textarea[name$=".actionAudioText"]`)?.value || "",
                            actionAudio: actionDiv.querySelector(`input[name$=".actionAudio"]`)?.value || "",
                            audioIsComment: actionDiv.querySelector(`input[name$=".audioIsComment"]`)?.checked || false,
                            actionFeedbacks: []
                        };

                        // Collecter les feedbacks de cette action
                        const feedbacksContainer = actionDiv.querySelector(`[id^="feedbacks-container-"]`);
                        if (feedbacksContainer) {
                            for (let k = 0; k < feedbacksContainer.children.length; k++) {
                                const feedbackDiv = feedbacksContainer.children[k];

                                // Récupérer le feedbackPrefab (stocké en JSON dans l'input hidden)
                                const prefabInput = feedbackDiv.querySelector('input[id^="feedbackPrefab-"]');
                                const prefabValue = prefabInput?.value || '[]';
                                let feedbackPrefabArray;
                                try {
                                    feedbackPrefabArray = JSON.parse(prefabValue);
                                } catch (e) {
                                    // Fallback si ce n'est pas du JSON valide
                                    feedbackPrefabArray = [];
                                }

                                const feedback = {
                                    feedbackPrefab: feedbackPrefabArray,
                                    feedbackPos: {
                                        x: parseInt(feedbackDiv.querySelector(`input[name$=".feedbackPos.x"]`)?.value) || 0,
                                        y: parseInt(feedbackDiv.querySelector(`input[name$=".feedbackPos.y"]`)?.value) || 0,
                                        z: parseInt(feedbackDiv.querySelector(`input[name$=".feedbackPos.z"]`)?.value) || 0
                                    },
                                    feedbackRot: {
                                        x: parseInt(feedbackDiv.querySelector(`input[name$=".feedbackRot.x"]`)?.value) || 0,
                                        y: parseInt(feedbackDiv.querySelector(`input[name$=".feedbackRot.y"]`)?.value) || 0,
                                        z: parseInt(feedbackDiv.querySelector(`input[name$=".feedbackRot.z"]`)?.value) || 0
                                    },
                                    feedbackPrefabScale: feedbackDiv.querySelector(`input[name$=".feedbackPrefabScale"]`)?.value || "1"
                                };
                                action.actionFeedbacks.push(feedback);
                            }
                        }

                        step.stepActions.push(action);
                    }
                }

                data.process.steps.push(step);
            }

            // Collecter les stages
            const stagesContainer = document.getElementById('stages-container');
            for (let i = 0; i < stagesContainer.children.length; i++) {
                const stage = {
                    stageID: parseInt(document.querySelector(`input[name="stage[${i}].stageID"]`).value) || 0,
                    stageTitle: document.querySelector(`input[name="stage[${i}].stageTitle"]`).value,
                    stageDesc: document.querySelector(`textarea[name="stage[${i}].stageDesc"]`).value,
                    stageRequiresStageID: parseInt(document.querySelector(`input[name="stage[${i}].stageRequiresStageID"]`).value,) || 0,
                    stagePath: document.getElementById(`stagePath-input-${i}`)?.value || ''
                };
                data.process.stages.push(stage);
            }

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
            //a.download = 'procedure.json';
            a.download = `${data.settings.chapter}_${data.process.processTitle}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showMessage('JSON exporté avec succès !');
        }

        // Charger les données dans le formulaire
        function loadDataToForm(data, isImporting = true) {
            isSettingData = true;
            // Si le JSON contient des informations de variante, on les stocke dans le localStorage
            if (isImporting && data.process && (data.process.workspaceShape || data.process.mainHologram)) {
                let existingData = {};
                try {
                    const stored = sessionStorage.getItem('iximaker_variant_data');
                    if (stored) {
                        existingData = JSON.parse(stored);
                    }
                } catch (e) {
                    console.error("Error reading existing variant data:", e);
                }

                const variantPart = {
                    usage: data.usage || existingData.usage || "",
                    settings: {
                        contentVersion: data.settings?.contentVersion || (existingData.settings?.contentVersion || 1),
                        ownerName: data.settings?.ownerName || (existingData.settings?.ownerName || ""),
                        ownerIdentifier: data.settings?.ownerIdentifier || (existingData.settings?.ownerIdentifier || ""),
                        appVersion: data.settings?.appVersion || (existingData.settings?.appVersion || "MiniMaker-1.0"),
                        chapter: data.settings?.chapter || (existingData.settings?.chapter || ""),
                        calibrateAfterStageID: data.settings?.calibrateAfterStageID || (existingData.settings?.calibrateAfterStageID || 0),
                        unit: data.settings?.unit || (existingData.settings?.unit || "mm"),
                        langCode: data.settings?.langCode || (existingData.settings?.langCode || "FR"),
                        creatorID: data.settings?.creatorID || (existingData.settings?.creatorID || 0)
                    },
                    process: {
                        processTitle: data.process.processTitle || (existingData.process?.processTitle || ""),
                        processDesc: data.process.processDesc || (existingData.process?.processDesc || ""),
                        workspaceShape: data.process.workspaceShape || (existingData.process?.workspaceShape || "square"),
                        workspaceShapeSize: data.process.workspaceShapeSize || (existingData.process?.workspaceShapeSize || { x: 0, y: 0, z: 0 }),
                        workspaceShapeRot: data.process.workspaceShapeRot || (existingData.process?.workspaceShapeRot || { x: 0, y: 0, z: 0 }),
                        workspaceOffsetPos: data.process.workspaceOffsetPos || (existingData.process?.workspaceOffsetPos || { x: 0, y: 0, z: 0 }),
                        workspaceOffsetRot: data.process.workspaceOffsetRot || (existingData.process?.workspaceOffsetRot || { x: 0, y: 0, z: 0 }),
                        mainHologram: data.process.mainHologram || (existingData.process?.mainHologram || ""),
                        steps: data.process.steps || (existingData.process?.steps || []),
                        stages: data.process.stages || (existingData.process?.stages || []),
                        topics: data.process.topics || (existingData.process?.topics || []),
                        courses: data.process.courses || (existingData.process?.courses || [])
                    }
                };
                sessionStorage.setItem('iximaker_variant_data', JSON.stringify(variantPart));
                checkSharedVariant();
            }

            // Charger les paramètres généraux
            document.getElementById('usage').value = data.usage || '';
            document.getElementById('contentVersion').value = data.settings?.contentVersion || '';

            const importedOwnerName = data.settings?.ownerName || '';
            const importedOwnerId = data.settings?.ownerIdentifier || '';

            if (isImporting) {
                if (importedOwnerName) {
                    document.getElementById('ownerName').value = importedOwnerName;
                    sessionStorage.setItem('iximaker_work_owner', importedOwnerName);
                }
                if (importedOwnerId) {
                    document.getElementById('ownerIdentifier').value = importedOwnerId;
                }
            } else {
                const localOwner = sessionStorage.getItem('iximaker_work_owner');
                if (localOwner) {
                    document.getElementById('ownerName').value = localOwner;
                } else {
                    document.getElementById('ownerName').value = '';
                }
                if (importedOwnerId) {
                    document.getElementById('ownerIdentifier').value = importedOwnerId;
                }
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
                const yVal = data.process?.workspaceOffsetPos?.y || 0;
                const hVal = data.process?.workspaceShapeSize?.y || 0;
                if (hVal > 0 && Math.abs(yVal - Math.round(hVal / 2)) <= 1) {
                    positionSelect.value = 'auto-high';
                } else if (hVal > 0 && Math.abs(yVal - Math.round(-hVal / 2)) <= 1) {
                    positionSelect.value = 'auto-low';
                } else {
                    positionSelect.value = 'auto-mid';
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
            document.getElementById('steps-container').innerHTML = '';
            document.getElementById('stages-container').innerHTML = '';

            // Snapshot des données source pour éviter de les effacer en réaffectant jsonData
            const stepsData = Array.isArray(data.process?.steps) ? data.process.steps.slice() : [];
            const stagesData = Array.isArray(data.process?.stages) ? data.process.stages.slice() : [];

            // Charger les étapes
            if (stepsData.length) {
                jsonData.process.steps = [];
                stepsData.forEach((step, index) => {
                    addStep();
                    const lastIndex = jsonData.process.steps.length - 1;

                    document.querySelector(`input[name="step[${lastIndex}].stepID"]`).value = step.stepID || 0;
                    document.querySelector(`input[name="step[${lastIndex}].stepTitle"]`).value = step.stepTitle || '';
                    document.querySelector(`textarea[name="step[${lastIndex}].stepDesc"]`).value = step.stepDesc || '';
                    document.querySelector(`input[name="step[${lastIndex}].stepImg"]`).value = step.stepImg || '';
                    document.querySelector(`input[name="step[${lastIndex}].stepHologram"]`).value = step.stepHologram || '';

                    // Chargement des offsets d'hologramme
                    document.querySelector(`input[name="step[${lastIndex}].stepHologramOffsetPos.x"]`).value = step.stepHologramOffsetPos?.x || 0;
                    setSafeTextContent(`stepHologramOffsetPosX-${lastIndex}`, step.stepHologramOffsetPos?.x);
                    document.querySelector(`input[name="step[${lastIndex}].stepHologramOffsetPos.y"]`).value = step.stepHologramOffsetPos?.y || 0;
                    setSafeTextContent(`stepHologramOffsetPosY-${lastIndex}`, step.stepHologramOffsetPos?.y);
                    document.querySelector(`input[name="step[${lastIndex}].stepHologramOffsetPos.z"]`).value = step.stepHologramOffsetPos?.z || 0;
                    setSafeTextContent(`stepHologramOffsetPosZ-${lastIndex}`, step.stepHologramOffsetPos?.z);

                    document.querySelector(`input[name="step[${lastIndex}].stepHologramOffsetRot.x"]`).value = step.stepHologramOffsetRot?.x || 0;
                    setSafeTextContent(`stepHologramOffsetRotX-${lastIndex}`, step.stepHologramOffsetRot?.x);
                    document.querySelector(`input[name="step[${lastIndex}].stepHologramOffsetRot.y"]`).value = step.stepHologramOffsetRot?.y || 0;
                    setSafeTextContent(`stepHologramOffsetRotY-${lastIndex}`, step.stepHologramOffsetRot?.y);
                    document.querySelector(`input[name="step[${lastIndex}].stepHologramOffsetRot.z"]`).value = step.stepHologramOffsetRot?.z || 0;
                    setSafeTextContent(`stepHologramOffsetRotZ-${lastIndex}`, step.stepHologramOffsetRot?.z);

                    document.querySelector(`input[name="step[${lastIndex}].stepHologramScale"]`).value = step.stepHologramScale || '1';
                    document.querySelector(`input[name="step[${lastIndex}].stepHologramInteractable"]`).checked = step.stepHologramInteractable || false;
                    document.querySelector(`input[name="step[${lastIndex}].stepHologramCalibrate"]`).checked = step.stepHologramCalibrate || false;
                    document.querySelector(`textarea[name="step[${lastIndex}].stepAudioText"]`).value = step.stepAudioText || '';
                    document.querySelector(`input[name="step[${lastIndex}].stepAudio"]`).value = step.stepAudio || '';
                    document.querySelector(`input[name="step[${lastIndex}].stepNote"]`).value = step.stepNote || '';

                    // Synchronise le span du titre d'étape
                    var titre = step.stepTitle || '';
                    var display = document.getElementById(`step-title-display-${lastIndex}`);
                    if (display) {
                        display.innerHTML = `ID${lastIndex + 1} | ${titre ? escapeHtml(titre) : 'Étape <b>sans nom</b>'}`;
                    }
                    // Ajoute l'écouteur pour la mise à jour dynamique
                    var input = document.querySelector(`input[name="step[${lastIndex}].stepTitle"]`);
                    if (input && display) {
                        input.addEventListener('input', function (e) {
                            display.innerHTML = `ID${lastIndex + 1} | ${e.target.value ? escapeHtml(e.target.value) : 'Étape <b>sans nom</b>'}`;
                        });
                    }
                    // Charger les actions
                    if (step.stepActions) {
                        step.stepActions.forEach((action, actionIndex) => {
                            addAction(lastIndex);
                            const lastActionIndex = jsonData.process.steps[lastIndex].stepActions.length - 1;

                            document.querySelector(`input[name="action[${lastIndex}][${lastActionIndex}].actionID"]`).value = action.actionID || lastActionIndex + 1;
                            document.querySelector(`input[name="action[${lastIndex}][${lastActionIndex}].actionTitle"]`).value = action.actionTitle || '';
                            document.querySelector(`textarea[name="action[${lastIndex}][${lastActionIndex}].actionDesc"]`).value = action.actionDesc || '';
                            document.querySelector(`input[name="action[${lastIndex}][${lastActionIndex}].actionImg"]`).value = action.actionImg || '';
                            document.querySelector(`input[name="action[${lastIndex}][${lastActionIndex}].feedbackItemTemplateID"]`).value = action.feedbackItemTemplateID || 0;
                            document.querySelector(`input[name="action[${lastIndex}][${lastActionIndex}].actionHologram"]`).value = action.actionHologram || '';
                            // Synchronise le titre de l'action dans le header
                            var actionTitre = action.actionTitle || '';
                            var actionDisplay = document.getElementById(`action-title-display-${lastIndex}-${lastActionIndex}`);
                            if (actionDisplay) {
                                actionDisplay.innerHTML = `ID${lastActionIndex + 1} | ${actionTitre ? escapeHtml(actionTitre) : 'Action <b>sans nom</b>'}`;
                            }
                            // Ajoute l'écouteur pour la mise à jour dynamique
                            var actionInput = document.querySelector(`input[name="action[${lastIndex}][${lastActionIndex}].actionTitle"]`);
                            if (actionInput && actionDisplay) {
                                actionInput.addEventListener('input', function (e) {
                                    actionDisplay.innerHTML = `ID${lastActionIndex + 1} | ${e.target.value ? escapeHtml(e.target.value) : 'Action <b>sans nom</b>'}`;
                                });
                            }

                            // Chargement des offsets d'action hologramme
                            document.querySelector(`input[name="action[${lastIndex}][${lastActionIndex}].actionHologramOffsetPos.x"]`).value = action.actionHologramOffsetPos?.x || 0;
                            setSafeTextContent(`actionHologramOffsetPosX-${lastIndex}-${lastActionIndex}`, action.actionHologramOffsetPos?.x);
                            document.querySelector(`input[name="action[${lastIndex}][${lastActionIndex}].actionHologramOffsetPos.y"]`).value = action.actionHologramOffsetPos?.y || 0;
                            setSafeTextContent(`actionHologramOffsetPosY-${lastIndex}-${lastActionIndex}`, action.actionHologramOffsetPos?.y);
                            document.querySelector(`input[name="action[${lastIndex}][${lastActionIndex}].actionHologramOffsetPos.z"]`).value = action.actionHologramOffsetPos?.z || 0;
                            setSafeTextContent(`actionHologramOffsetPosZ-${lastIndex}-${lastActionIndex}`, action.actionHologramOffsetPos?.z);

                            document.querySelector(`input[name="action[${lastIndex}][${lastActionIndex}].actionHologramOffsetRot.x"]`).value = action.actionHologramOffsetRot?.x || 0;
                            setSafeTextContent(`actionHologramOffsetRotX-${lastIndex}-${lastActionIndex}`, action.actionHologramOffsetRot?.x);
                            document.querySelector(`input[name="action[${lastIndex}][${lastActionIndex}].actionHologramOffsetRot.y"]`).value = action.actionHologramOffsetRot?.y || 0;
                            setSafeTextContent(`actionHologramOffsetRotY-${lastIndex}-${lastActionIndex}`, action.actionHologramOffsetRot?.y);
                            document.querySelector(`input[name="action[${lastIndex}][${lastActionIndex}].actionHologramOffsetRot.z"]`).value = action.actionHologramOffsetRot?.z || 0;
                            setSafeTextContent(`actionHologramOffsetRotZ-${lastIndex}-${lastActionIndex}`, action.actionHologramOffsetRot?.z);

                            document.querySelector(`textarea[name="action[${lastIndex}][${lastActionIndex}].actionAudioText"]`).value = action.actionAudioText || '';
                            document.querySelector(`input[name="action[${lastIndex}][${lastActionIndex}].actionAudio"]`).value = action.actionAudio || '';
                            document.querySelector(`input[name="action[${lastIndex}][${lastActionIndex}].audioIsComment"]`).checked = action.audioIsComment !== false;

                            // Charger les feedbacks
                            if (action.actionFeedbacks) {
                                action.actionFeedbacks.forEach((feedback, feedbackIndex) => {
                                    addFeedback(lastIndex, lastActionIndex);
                                    const lastFeedbackIndex = jsonData.process.steps[lastIndex].stepActions[lastActionIndex].actionFeedbacks.length - 1;

                                    // Assigner l'ID séquentiel pour le DOM (utilisé par le drag & drop)
                                    document.querySelector(`input[name="feedback[${lastIndex}][${lastActionIndex}][${lastFeedbackIndex}].feedbackID"]`).value = lastFeedbackIndex + 1;

                                    // Mettre à jour l'input hidden du prefab (stocker en JSON)
                                    const hiddenInput = document.getElementById(`feedbackPrefab-${lastIndex}-${lastActionIndex}-${lastFeedbackIndex}`);
                                    const prefabArray = feedback.feedbackPrefab || [];
                                    if (hiddenInput) {
                                        hiddenInput.value = JSON.stringify(prefabArray);
                                    }

                                    // Parser le feedbackPrefab (maintenant c'est un tableau)
                                    const feedbackDiv = document.getElementById(`feedback-${lastIndex}-${lastActionIndex}-${lastFeedbackIndex}`);

                                    if (feedbackDiv) {
                                        // prefabArray: ["point", "out", "horizontal"] ou ["point", "out", "horizontal", "distance"]
                                        const type = prefabArray[0] || 'point';
                                        const direction = prefabArray[1] || 'out';
                                        const orientation = prefabArray[2] || 'horizontal';
                                        const hasDistance = prefabArray.length > 3 && prefabArray[3] === 'distance';

                                        // Activer les boutons correspondants
                                        feedbackDiv.querySelectorAll('.feedback-type-btn').forEach(btn => {
                                            btn.classList.toggle('active', btn.dataset.type === type);
                                        });

                                        feedbackDiv.querySelectorAll('[data-option="in"], [data-option="out"]').forEach(btn => {
                                            btn.classList.toggle('active', btn.dataset.option === direction);
                                        });

                                        feedbackDiv.querySelectorAll('[data-option="vertical"], [data-option="horizontal"]').forEach(btn => {
                                            btn.classList.toggle('active', btn.dataset.option === orientation);
                                        });

                                        // Restaurer l'état du bouton Distance depuis le JSON
                                        const distanceBtn = document.getElementById(`distance-btn-${lastIndex}-${lastActionIndex}-${lastFeedbackIndex}`);
                                        if (distanceBtn) {
                                            distanceBtn.dataset.option = hasDistance ? 'oui' : 'non';
                                            distanceBtn.textContent = hasDistance ? 'Oui' : 'Non';
                                            if (hasDistance) {
                                                distanceBtn.classList.add('active');
                                            } else {
                                                distanceBtn.classList.remove('active');
                                            }
                                        }

                                        // Afficher/masquer les options selon le type
                                        const optionsDiv = document.getElementById(`feedback-options-${lastIndex}-${lastActionIndex}-${lastFeedbackIndex}`);
                                        if (optionsDiv) {
                                            optionsDiv.style.display = type === 'point' ? 'flex' : 'none';
                                        }

                                        // Mettre à jour le titre
                                        updateFeedbackDisplayTitle(lastIndex, lastActionIndex, lastFeedbackIndex);
                                    }

                                    document.querySelector(`input[name="feedback[${lastIndex}][${lastActionIndex}][${lastFeedbackIndex}].feedbackPos.x"]`).value = feedback.feedbackPos?.x || 0;
                                    document.querySelector(`input[name="feedback[${lastIndex}][${lastActionIndex}][${lastFeedbackIndex}].feedbackPos.y"]`).value = feedback.feedbackPos?.y || 0;
                                    document.querySelector(`input[name="feedback[${lastIndex}][${lastActionIndex}][${lastFeedbackIndex}].feedbackPos.z"]`).value = feedback.feedbackPos?.z || 0;

                                    document.querySelector(`input[name="feedback[${lastIndex}][${lastActionIndex}][${lastFeedbackIndex}].feedbackRot.x"]`).value = feedback.feedbackRot?.x || 0;
                                    document.querySelector(`input[name="feedback[${lastIndex}][${lastActionIndex}][${lastFeedbackIndex}].feedbackRot.y"]`).value = feedback.feedbackRot?.y || 0;
                                    document.querySelector(`input[name="feedback[${lastIndex}][${lastActionIndex}][${lastFeedbackIndex}].feedbackRot.z"]`).value = feedback.feedbackRot?.z || 0;

                                    document.querySelector(`input[name="feedback[${lastIndex}][${lastActionIndex}][${lastFeedbackIndex}].feedbackPrefabScale"]`).value = feedback.feedbackPrefabScale || '1';
                                });
                            }
                        })
                    }
                });
            }

            // Charger les stages
            if (stagesData.length) {
                jsonData.process.stages = [];
                stagesData.forEach((stage, index) => {
                    addStage();
                    const lastIndex = jsonData.process.stages.length - 1;

                    document.querySelector(`input[name="stage[${lastIndex}].stageID"]`).value = stage.stageID || 0;
                    document.querySelector(`input[name="stage[${lastIndex}].stageTitle"]`).value = stage.stageTitle || '';
                    document.querySelector(`textarea[name="stage[${lastIndex}].stageDesc"]`).value = stage.stageDesc || '';
                    document.querySelector(`input[name="stage[${lastIndex}].stageRequiresStageID"]`).value = stage.stageRequiresStageID || 0;
                    const hiddenInput = document.getElementById(`stagePath-input-${lastIndex}`);
                    if (hiddenInput) {
                        hiddenInput.value = stage.stagePath || '';
                        // Reconstruit les listes dispo/sélection à partir de la valeur existante
                        initStagePathBuilder(lastIndex);
                    }
                    // synchronise le span du titre de stage
                    var stageDisplay = document.getElementById(`stage-title-display-${lastIndex}`);
                    var stageInput = document.querySelector(`input[name="stage[${lastIndex}].stageTitle"]`);
                    if (stageDisplay && stageInput) {
                        stageDisplay.innerHTML = `Procédure ${lastIndex + 1}${stageInput.value ? ' | ' + stageInput.value : ''}`;
                        // Ajoute l'écouteur pour la mise à jour dynamique
                        stageInput.addEventListener('input', function (e) {
                            stageDisplay.innerHTML = `<b>Procédure ${lastIndex + 1}${e.target.value ? ' | </b>' + e.target.value : ''}`;
                            jsonData.process.stages[lastIndex].stageTitle = e.target.value;
                        });
                    }
                });
            }
            //mise à jour de tous les constructeurs de chemin de stage
            jsonData.process.steps.forEach((step, i) => {
                const titleInput = document.querySelector(`input[name="step[${i}].stepTitle"]`);
                if (titleInput) step.stepTitle = titleInput.value;
            });
            refreshAllStagePathBuilders();

            // Configure le drag & drop pour le conteneur de steps
            // setupStepsContainerDrop(); // Drag & drop désactivé pour les étapes
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
                    loadDataToForm(imported);
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
                document.getElementById('steps-container').innerHTML = '';
                document.getElementById('stages-container').innerHTML = '';
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
                        langCode: ""
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
                        steps: [],
                        stages: []
                    }
                };
                // stepIdCounter = 1;
                stageIdCounter = 1;
                actionIdCounter = 1;
                showMessage('Formulaire réinitialisé');
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

                    // Prefill all variant parameters in Work page
                    if (variantData.usage) {
                        const usageInput = document.getElementById('usage');
                        if (usageInput) usageInput.value = variantData.usage;
                    }
                    
                    const settingsMapping = {
                        'contentVersion': variantData.settings?.contentVersion || '',
                        'ownerIdentifier': variantData.settings?.ownerIdentifier || '',
                        'appVersion': variantData.settings?.appVersion || 'MiniMaker-1.0',
                        'chapter': variantData.settings?.chapter || '',
                        'calibrateAfterStageID': variantData.settings?.calibrateAfterStageID || 0,
                        'unit': variantData.settings?.unit || 'mm',
                        'langCode': variantData.settings?.langCode || 'FR',
                        'creatorID': variantData.settings?.creatorID || 0
                    };
                    for (const [id, val] of Object.entries(settingsMapping)) {
                        const input = document.getElementById(id);
                        if (input) input.value = val;
                    }

                    const processMapping = {
                        'processTitle': variantData.process?.processTitle || '',
                        'processDesc': variantData.process?.processDesc || '',
                        'workspaceShape': variantData.process?.workspaceShape || 'square',
                        'mainHologram': variantData.process?.mainHologram || ''
                    };
                    for (const [id, val] of Object.entries(processMapping)) {
                        const input = document.getElementById(id);
                        if (input) {
                            input.value = val;
                            input.dispatchEvent(new Event('change'));
                        }
                    }

                    // Vector sizes
                    const sizeX = document.querySelector('input[name="process.workspaceShapeSize.x"]');
                    if (sizeX) sizeX.value = variantData.process?.workspaceShapeSize?.x || 0;
                    const sizeY = document.querySelector('input[name="process.workspaceShapeSize.y"]');
                    if (sizeY) sizeY.value = variantData.process?.workspaceShapeSize?.y || 0;
                    const sizeZ = document.querySelector('input[name="process.workspaceShapeSize.z"]');
                    if (sizeZ) sizeZ.value = variantData.process?.workspaceShapeSize?.z || 0;

                    // Rotations
                    const rotX = document.querySelector('input[name="process.workspaceShapeRot.x"]');
                    if (rotX) rotX.value = variantData.process?.workspaceShapeRot?.x || 0;
                    const rotY = document.querySelector('input[name="process.workspaceShapeRot.y"]');
                    if (rotY) rotY.value = variantData.process?.workspaceShapeRot?.y || 0;
                    const rotZ = document.querySelector('select[name="process.workspaceShapeRot.z"]');
                    if (rotZ) {
                        const isVertical = (variantData.process?.workspaceShapeRot?.x === -90 || variantData.process?.workspaceShapeRot?.z === 90);
                        rotZ.value = isVertical ? 90 : 0;
                        rotZ.dispatchEvent(new Event('change'));
                    }

                    // Offsets
                    const offsetValX = document.querySelector('input[name="process.workspaceOffsetPos.x"]');
                    if (offsetValX) offsetValX.value = variantData.process?.workspaceOffsetPos?.x || 0;
                    const offsetValY = document.querySelector('input[name="process.workspaceOffsetPos.y"]');
                    if (offsetValY) offsetValY.value = variantData.process?.workspaceOffsetPos?.y || 0;
                    const offsetValZ = document.querySelector('input[name="process.workspaceOffsetPos.z"]');
                    if (offsetValZ) offsetValZ.value = variantData.process?.workspaceOffsetPos?.z || 0;

                    const offsetRotX = document.querySelector('input[name="process.workspaceOffsetRot.x"]');
                    if (offsetRotX) offsetRotX.value = variantData.process?.workspaceOffsetRot?.x || 0;
                    const offsetRotY = document.querySelector('input[name="process.workspaceOffsetRot.y"]');
                    if (offsetRotY) offsetRotY.value = variantData.process?.workspaceOffsetRot?.y || 0;
                    const offsetRotZ = document.querySelector('input[name="process.workspaceOffsetRot.z"]');
                    if (offsetRotZ) offsetRotZ.value = variantData.process?.workspaceOffsetRot?.z || 0;

                    const offsetValP = document.getElementById('workspaceOffsetPosP');
                    if (offsetValP && variantData.process?.workspaceOffsetPos?.x !== undefined) {
                        offsetValP.value = variantData.process.workspaceOffsetPos.x;
                    }

                    // Déduire et restaurer la position du select workspaceOffsetCalc
                    const positionSelect = document.getElementById('workspaceOffsetCalc');
                    if (positionSelect) {
                        if (variantData.process?.workspaceOffsetCalc) {
                            positionSelect.value = variantData.process.workspaceOffsetCalc;
                        } else {
                            const yVal = variantData.process?.workspaceOffsetPos?.y || 0;
                            const hVal = variantData.process?.workspaceShapeSize?.y || 0;
                            if (hVal > 0 && Math.abs(yVal - Math.round(hVal / 2)) <= 1) {
                                positionSelect.value = 'auto-high';
                            } else if (hVal > 0 && Math.abs(yVal - Math.round(-hVal / 2)) <= 1) {
                                positionSelect.value = 'auto-low';
                            } else {
                                positionSelect.value = 'auto-mid';
                            }
                        }
                    }

                    // Update UI labels
                    if (typeof updatePositionLabels === 'function') {
                        updatePositionLabels();
                    }
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
            if (typeof resetForm === 'function') {
                resetForm(true);
            }
            showMessage('Variante effacée de la mémoire et formulaire réinitialisé');
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

        function goToPage(pageUrl) {
            try {
                sessionStorage.setItem('is_navigating', 'true');
                if (!sessionStorage.getItem('iximaker_variant_data')) {
                    window.location.href = pageUrl;
                    return;
                }
                const data = collectFormData();
                saveSharedVariant(data);
                window.location.href = pageUrl;
            } catch (error) {
                window.location.href = pageUrl;
            }
        }
