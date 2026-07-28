
        // json structure
        let jsonData = {
            usage: "",
            settings: {
                contentVersion: 1,
                creatorID: 0,
                ownerName: "",
                ownerIdentifier: ""
            },
            process: {
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

            // Gestionnaire pour l'import JSON
            const jsonImportElem = document.getElementById('json-import');
            if (jsonImportElem) {
                jsonImportElem.addEventListener('change', function (e) {
                    if (e.target.files.length > 0) {
                        // Ne rien faire ici, l'import sera déclenché par la fonction importJSON()
                    }
                });
            }

            window.addEventListener('resize', function() {
                document.querySelectorAll('[id^="feedback-posrot-toggle-"], [id^="quizz-posrot-toggle-"]').forEach(btn => {
                    const isClosed = btn.textContent.includes('▼');
                    const labelText = window.innerWidth <= 900 ? 'Pos & Rot' : 'Position & rotation';
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
                const localOwner = sessionStorage.getItem('iximaker_learn_owner');
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
                    sessionStorage.setItem('iximaker_learn_owner', e.target.value);
                });
            }
        });

        // ---- Gestion du drag & drop pour les chemins des Topics dans Courses ----
        function initcoursePathBuilder(courseIndex) {
            const availableContainer = document.getElementById(`courseAvailabletopics-${courseIndex}`);
            const selectedContainer = document.getElementById(`courseSelectedtopics-${courseIndex}`);
            const hiddenInput = document.getElementById(`coursePath-input-${courseIndex}`);

            if (!availableContainer || !selectedContainer || !hiddenInput) return;

            // Nettoyer
            availableContainer.innerHTML = '';
            selectedContainer.innerHTML = '';

            // Construire la liste des IDs des Topics à partir du JSON
            const topics = jsonData.process.topics || [];

            // Topics déjà utilisés dans cette course (ne doivent pas apparaître dans la liste disponible)
            const usedIds = (hiddenInput.value || '')
                .split('.')
                .map(v => v.trim())
                .filter(v => v);

            topics.forEach((topic, idx) => {
                const topicId = String(topic.topicID || (idx + 1));

                // Si déjà utilisé dans le chemin, ne pas l'afficher dans la liste des disponibles
                if (usedIds.includes(topicId)) {
                    return;
                }

                const title = topic.topicTitle || `Questionnaire ${topicId}`;
                const item = document.createElement('div');
                item.className = 'course-topic-item';
                item.draggable = true;
                item.dataset.topicId = topicId;
                item.textContent = `Questionnaire ${topicId} - ${title}`;

                // Clic : ajouter/enlever du chemin
                item.addEventListener('click', function () {
                    toggletopicIncoursePath(courseIndex, topicId, title);
                });

                setupDragEventsForItem(item, courseIndex);
                availableContainer.appendChild(item);
            });

            setupcourseSelectedListDnD(courseIndex);

            // Si un chemin existe déjà dans l'input caché, le refléter dans l'UI
            if (hiddenInput.value) {
                applycoursePathToUI(courseIndex, hiddenInput.value);
            }
        }
        // rafraîchir tous les builders de chemin de cours
        function refreshAllcoursePathBuilders() {
            const coursesContainer = document.getElementById('courses-container');
            if (!coursesContainer) return;

            for (let i = 0; i < coursesContainer.children.length; i++) {
                initcoursePathBuilder(i);
            }
        }
        // Ajouter ou enlever un topic du chemin du cours
        function toggletopicIncoursePath(courseIndex, topicId, title) {
            const selectedContainer = document.getElementById(`courseSelectedtopics-${courseIndex}`);
            const hiddenInput = document.getElementById(`coursePath-input-${courseIndex}`);
            if (!selectedContainer || !hiddenInput) return;

            // Vérifier si déjà présent
            const existing = Array.from(selectedContainer.children).find(el => el.dataset.topicId == topicId);

            if (existing) {
                selectedContainer.removeChild(existing);
            } else {
                const item = createcourseSelectedItem(courseIndex, topicId, title);
                selectedContainer.appendChild(item);
            }

            updatecoursePathFromUI(courseIndex);
            // Rebuild pour refléter la nouvelle répartition disponible / sélectionné
            initcoursePathBuilder(courseIndex);
        }
        function createcourseSelectedItem(courseIndex, topicId, title) {
            const item = document.createElement('div');
            item.className = 'course-topic-item selected';
            item.draggable = true;
            item.dataset.topicId = topicId;

            const label = document.createElement('span');
            label.className = 'course-topic-item-label';
            label.textContent = `ID${topicId} - ${title}`;

            const controls = document.createElement('div');
            controls.className = 'course-topic-item-controls';

            const upBtn = document.createElement('button');
            upBtn.type = 'button';
            upBtn.className = 'course-topic-item-btn';
            upBtn.textContent = '▲';
            upBtn.title = 'Monter';
            upBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                moveTopicIncoursePath(courseIndex, topicId, -1);
            });

            const downBtn = document.createElement('button');
            downBtn.type = 'button';
            downBtn.className = 'course-topic-item-btn';
            downBtn.textContent = '▼';
            downBtn.title = 'Descendre';
            downBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                moveTopicIncoursePath(courseIndex, topicId, 1);
            });

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'course-topic-item-btn';
            removeBtn.textContent = '✕';
            removeBtn.title = 'Retirer du cours';
            removeBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                removeTopicFromcoursePath(courseIndex, topicId);
            });

            controls.appendChild(upBtn);
            controls.appendChild(downBtn);
            controls.appendChild(removeBtn);
            item.appendChild(label);
            item.appendChild(controls);

            setupDragEventsForItem(item, courseIndex);
            return item;
        }
        function moveTopicIncoursePath(courseIndex, topicId, direction) {
            const selectedContainer = document.getElementById(`courseSelectedtopics-${courseIndex}`);
            if (!selectedContainer) return;

            const items = Array.from(selectedContainer.children);
            const currentIndex = items.findIndex(el => String(el.dataset.topicId) === String(topicId));
            if (currentIndex < 0) return;

            const targetIndex = currentIndex + direction;
            if (targetIndex < 0 || targetIndex >= items.length) return;

            const currentItem = items[currentIndex];
            if (direction < 0) {
                selectedContainer.insertBefore(currentItem, items[targetIndex]);
            } else {
                selectedContainer.insertBefore(currentItem, items[targetIndex].nextSibling);
            }

            updatecoursePathFromUI(courseIndex);
            initcoursePathBuilder(courseIndex);
        }
        function removeTopicFromcoursePath(courseIndex, topicId) {
            const selectedContainer = document.getElementById(`courseSelectedtopics-${courseIndex}`);
            if (!selectedContainer) return;

            const elementToRemove = Array.from(selectedContainer.children)
                .find(el => String(el.dataset.topicId) === String(topicId));
            if (!elementToRemove) return;

            selectedContainer.removeChild(elementToRemove);
            updatecoursePathFromUI(courseIndex);
            initcoursePathBuilder(courseIndex);
        }
        // Configurer les événements de drag pour un élément
        function setupDragEventsForItem(item, courseIndex) {
            item.addEventListener('dragstart', function (e) {
                if (e.target && e.target.closest('.course-topic-item-controls')) {
                    e.preventDefault();
                    return;
                }
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', JSON.stringify({
                    courseIndex,
                    topicId: item.dataset.topicId,
                    text: item.textContent
                }));
            });

            item.addEventListener('dragend', function () {
                item.classList.remove('dragging');
            });
        }
        // Configurer le drag & drop pour la liste sélectionnée
        function setupcourseSelectedListDnD(courseIndex) {
            const selectedContainer = document.getElementById(`courseSelectedtopics-${courseIndex}`);
            const availableContainer = document.getElementById(`courseAvailabletopics-${courseIndex}`);
            if (!selectedContainer) return;

            selectedContainer.addEventListener('dragover', function (e) {
                e.preventDefault();
                selectedContainer.classList.add('drag-over');
                const afterElement = getDragAfterElement(selectedContainer, e.clientX, e.clientY);
                const dragging = document.querySelector('.course-topic-item.dragging');
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
                        if (data.courseIndex === courseIndex) {
                            // Si l'élément vient de la liste des disponibles, l'ajouter
                            const alreadyInSelected = Array.from(selectedContainer.children)
                                .some(el => el.dataset.topicId == data.topicId);
                            if (!alreadyInSelected) {
                                const item = document.createElement('div');
                                item.className = 'course-topic-item selected';
                                item.draggable = true;
                                item.dataset.topicId = data.topicId;
                                item.textContent = data.text;
                                setupDragEventsForItem(item, courseIndex);

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

                updatecoursePathFromUI(courseIndex);
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
                            if (data.courseIndex === courseIndex) {
                                // Supprimer l'élément de la colonne sélectionnée
                                const elementToRemove = Array.from(selectedContainer.children)
                                    .find(el => el.dataset.topicId == data.topicId);
                                if (elementToRemove) {
                                    selectedContainer.removeChild(elementToRemove);
                                    updatecoursePathFromUI(courseIndex);
                                    // Rebuild pour refléter la nouvelle répartition
                                    initcoursePathBuilder(courseIndex);
                                }
                            }
                        } catch (err) {
                            // ignore
                        }
                    }
                });
            }
        }
        // Obtenir l'élément après lequel insérer lors du drag
        function getDragAfterElement(container, x, y) {
            const draggableElements = [...container.querySelectorAll('.course-topic-item:not(.dragging)')];

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

        // Synchronise les champs généraux (procédure / settings) du DOM vers le modèle sans toucher topics/courses
        function syncTopLevelToModelFromDOM() {
            try {
                const cf = collectFormData();
                jsonData.usage = cf.usage;
                jsonData.settings = { ...jsonData.settings, ...cf.settings };
            } catch (e) {
                // on ignore les erreurs de lecture pour ne pas bloquer
            }
        }
        // Mettre à jour l'input caché du chemin à partir de l'UI
        function updatecoursePathFromUI(courseIndex) {
            const selectedContainer = document.getElementById(`courseSelectedtopics-${courseIndex}`);
            const hiddenInput = document.getElementById(`coursePath-input-${courseIndex}`);
            if (!selectedContainer || !hiddenInput) return;

            const ids = Array.from(selectedContainer.children).map(el => el.dataset.topicId);
            hiddenInput.value = ids.join('.');
        }
        // Appliquer un chemin existant à l'UI
        function applycoursePathToUI(courseIndex, pathValue) {
            const selectedContainer = document.getElementById(`courseSelectedtopics-${courseIndex}`);
            if (!selectedContainer) return;

            selectedContainer.innerHTML = '';
            if (!pathValue) return;

            const ids = pathValue.split('.').filter(Boolean);
            ids.forEach(id => {
                const topicId = id.trim();
                if (!topicId) return;

                // Retrouver le titre du Questionnaire
                const topic = (jsonData.process.topics || []).find(s => String(s.topicID) === topicId);
                const title = topic ? (topic.topicTitle || `Questionnaire ${topicId}`) : `Questionnaire ${topicId}`;

                const item = createcourseSelectedItem(courseIndex, topicId, title);
                selectedContainer.appendChild(item);
            });
        }

        // Fonction pour ajouter un topic
        function addTopic() {
            const container = document.getElementById('topics-container');
            const topicIndex = jsonData.process.topics.length;
            const topicDiv = document.createElement('div');
            topicDiv.className = 'array-item collapsed section-topic';
            topicDiv.id = `topic-${topicIndex}`;

            topicDiv.innerHTML = `
                <div class="array-item-header">
                        <button type="button" class="btn btn-collapse" onclick="toggleCollapse('topic-${topicIndex}')">
                            ⇵ Réduire/Agrandir
                        </button>
                    <span class="array-item-title" id="topic-title-display-${topicIndex}">ID${topicIndex + 1} | Questionnaire <b>sans nom</b> </span>
                    <div class="header-controls">
                        <button type="button" class="btn btn-add" onclick="duplicateTopic(${topicIndex})" style="width: 120px; margin-right: 10px; margin-top: 5px; margin-bottom: 5px;">
                            ⧉ Dupliquer
                        </button>
                        <button type="button" class="btn btn-remove" onclick="removetopic(${topicIndex})">
                           ✕ Supprimer
                        </button>
                    </div>
                </div>
                <div class="collapsible-content">
                    <div class="form-row top-spacer" style="margin-top: 20px;">
                            <input type="hidden" name="topic[${topicIndex}].topicID" value="${topicIndex + 1}">
                            <input type="hidden" name="topic[${topicIndex}].topicHologramOffsetPos.x" id="topicHologramOffsetPosXInput-${topicIndex}" value="0">
                            <input type="hidden" name="topic[${topicIndex}].topicHologramOffsetPos.y" id="topicHologramOffsetPosYInput-${topicIndex}" value="0">
                            <input type="hidden" name="topic[${topicIndex}].topicHologramOffsetPos.z" id="topicHologramOffsetPosZInput-${topicIndex}" value="0">
                            <input type="hidden" name="topic[${topicIndex}].topicHologramOffsetRot.x" id="topicHologramOffsetRotXInput-${topicIndex}" value="0">
                            <input type="hidden" name="topic[${topicIndex}].topicHologramOffsetRot.y" id="topicHologramOffsetRotYInput-${topicIndex}" value="0">
                            <input type="hidden" name="topic[${topicIndex}].topicHologramOffsetRot.z" id="topicHologramOffsetRotZInput-${topicIndex}" value="0">
                            <input type="hidden" name="topic[${topicIndex}].topicHologramScale" value="1">

                            <div class="form-group">
                                <label title="ℹ️ Nom du questionnaire traité, tel qu'il sera affiché dans l'interface utilisateur.">Titre du Questionnaire <span class="icon-color">ℹ️</span></label>
                                <input type="text" name="topic[${topicIndex}].topicTitle" placeholder="Ex: Démontage de...">
                            </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label title="ℹ️ Environnement 360° optionnel du questionnaire, Si vide, l'utilisateur verra son environnement réel.">Image Env. 360° <span class="icon-color">ℹ️</span></label>
                                <div class="file-input-wrapper">
                                    <input type="text" name="topic[${topicIndex}].topicEnv360" placeholder="Aucun nom de fichier">
                                    <input type="file" id="topicEnv360-${topicIndex}" accept="image/*">
                                    <button type="button" class="file-button" onclick="document.getElementById('topicEnv360-${topicIndex}').click()">
                                        Choisir un fichier
                                    </button>
                                </div>
                            </div>
                            <div class="form-group" title="ℹ️ Rotation de l'environnement 360° (en degrés).">
                                <label>Rotation <span class="icon-color">ℹ️</span></label>
                                <input type="choiceID" name="topic[${topicIndex}].topicEnv360Rot" value="0" step="1">
                            </div>
                       </div>
                        </div>

                        <div class="form-row" style="margin-top: 30px;">
                            <div class="form-group">
                                <label title="ℹ️ Description du sujet, tel qu'il sera affiché dans l'interface utilisateur.">Description <span class="icon-color">ℹ️</span></label>
                                <textarea name="topic[${topicIndex}].topicDesc" placeholder="Détails du Questionnaire"></textarea>
                            </div>
                            <div class="form-group">
                                <label title="ℹ️ Texte à convertir en commentaire audio. Fournit à l'utilisateur des informations complémentaires sur le sujet en cours.">Texte audio <span class="icon-color">ℹ️</span></label>
                                <textarea name="topic[${topicIndex}].topicAudioText" placeholder="Texte du commentaire audio"></textarea>
                            </div>
                        </div>

                        <div class="form-row" style="margin-top: 30px;">
                            <div class="form-group">
                                <label title="ℹ️ Image du topic, affiché en dessous de la description dans l'interface utilisateur.">Image du sujet (png/jpg) <span class="icon-color">ℹ️</span></label>
                                <div class="file-input-wrapper">
                                    <input type="text" name="topic[${topicIndex}].topicImg" placeholder="Aucun nom de fichier">
                                    <input type="file" id="topicImg-${topicIndex}" accept="image/*">
                                    <button type="button" class="file-button" onclick="document.getElementById('topicImg-${topicIndex}').click()">
                                        Choisir un fichier
                                    </button>
                                </div>
                            </div>
                            <div class="form-group">
                                <label title="ℹ️ Modèles 3D, spécifique au sujet traité (format .glb). Il remplace momentanément le modèle 3D principal de la procédure. (Par exemple, pour montrer un objet partiellement démonté.)">Hologramme secondaire (glb)<span class="icon-color">ℹ️</span></label>
                                <div class="file-input-wrapper">
                                    <input type="text" name="topic[${topicIndex}].topicHologram" placeholder="Aucun nom de fichier">
                                    <input type="file" id="topicHologram-${topicIndex}" accept=".glb,.gltf">
                                    <button type="button" class="file-button" onclick="document.getElementById('topicHologram-${topicIndex}').click()">
                                        Choisir un fichier
                                    </button>
                                </div>
                                <div class="form-group" title="ℹ️ Si actif : le modèle 3D sera manipulable
Si inactif : l'hologramme principal sera remplacé le temps du Questionnaire">
                                    <label class="checkbox-wrapper">
                                    <input type="checkbox" 
                                    title="ℹ️ Si actif : le modèle 3D sera un jumeau numérique manipulable"
                                    name="topic[${topicIndex}].topicHologramInteractable"> Hologramme interactif <span class="icon-color">ℹ️</span>
                                    </label>
                                </div>
                            </div>
                            <div class="form-group">
                                <label title="ℹ️ Fichier audio du commentaire. Remplace le texte audio."> Audio <span class="icon-color">ℹ️</span></label>
                                <div class="file-input-wrapper">
                                    <input type="text" name="topic[${topicIndex}].topicAudio" placeholder="Aucun nom de fichier">
                                    <input type="file" id="topicAudio-${topicIndex}" accept="audio/*">
                                    <button type="button" class="file-button" onclick="document.getElementById('topicAudio-${topicIndex}').click()">
                                        Choisir un fichier
                                    </button>
                                </div>
                            </div>
                             <div class="form-group">
                                <label title="ℹ️ Procédure liée, à réaliser avant de commencer la question (mode mixte)">Procédure requise (N° d'ID) <span class="icon-color">ℹ️</span></label>
                                <input type="number" name="topic[${topicIndex}].linkedStageID" value="0" min="0" placeholder="0">
                            </div>
                        </div>

                        <div style="display:none;">
                        </div>

                    <h3>Liste des Questions</h3>
                    <div id="quizzes-container-${topicIndex}" class="array-container"></div>
                    <button type="button" class="btn btn-add center" onclick="addquizz(${topicIndex})">
                        + Ajouter une question
                    </button>
                    
                </div>
            `;

            container.appendChild(topicDiv);

            // Gestionnaires de fichiers pour ce Topic
            document.getElementById(`topicImg-${topicIndex}`).addEventListener('change', function (e) {
                if (e.target.files.length > 0) {
                    document.querySelector(`input[name="topic[${topicIndex}].topicImg"]`).value = e.target.files[0].name;
                }
            });

            document.getElementById(`topicHologram-${topicIndex}`).addEventListener('change', function (e) {
                if (e.target.files.length > 0) {
                    document.querySelector(`input[name="topic[${topicIndex}].topicHologram"]`).value = e.target.files[0].name;
                }
            });

            document.getElementById(`topicAudio-${topicIndex}`).addEventListener('change', function (e) {
                if (e.target.files.length > 0) {
                    document.querySelector(`input[name="topic[${topicIndex}].topicAudio"]`).value = e.target.files[0].name;
                }
            });

            document.getElementById(`topicEnv360-${topicIndex}`).addEventListener('change', function (e) {
                if (e.target.files.length > 0) {
                    document.querySelector(`input[name="topic[${topicIndex}].topicEnv360"]`).value = e.target.files[0].name;
                }
            });

              document.querySelector(`input[name="topic[${topicIndex}].topicEnv360Rot"]`).addEventListener('input', function (e) {
                // Mise à jour de la valeur dans le modèle de données
                const topic = jsonData.process.topics[topicIndex];
                if (topic) {
                    topic.topicEnv360Rot = e.target.value;
                }
            });

            jsonData.process.topics.push({
                topicID: topicIndex + 1,
                topicTitle: "",
                topicDesc: "",
                topicImg: "",
                topicHologram: "",
                linkedStageID: "",
                topicEnv360: "",
                topicEnv360Rot: "",
                topicHologramOffsetPos: { x: 0, y: 0, z: 0 },
                topicHologramOffsetRot: { x: 0, y: 0, z: 0 },
                topicHologramInteractable: false,
                topicAudioText: "",
                topicAudio: "",
                quizzes: []
            });
            // Mise à jour dynamique du titre dans le header du Topic
            var display = document.getElementById(`topic-title-display-${topicIndex}`);
            var input = document.querySelector(`input[name="topic[${topicIndex}].topicTitle"]`);
            if (input && display) {
                input.addEventListener('input', function (e) {
                    //display.innerHTML = `<b>Questionnaire ${topicIndex + 1}${e.target.value ? ' | </b>' + e.target.value : ''}`;
                    display.innerHTML = `ID${topicIndex + 1} ${e.target.value ? ' | <b>' + escapeHtml(e.target.value)+'</b>' : ''}`;
                    // Synchronise le modèle
                    jsonData.process.topics[topicIndex].topicTitle = e.target.value;
                    // Met à jour les listes de courses pour refléter le nouveau titre
                    refreshAllcoursePathBuilders();
                });
            }        

            // Configure le drag & drop pour ce topic
            // setupTopicDragAndDrop(topicDiv); // Drag & drop désactivé pour les topics

            // Rafraîchit les builders de cours pour rendre le topic disponible tout de suite
            refreshAllcoursePathBuilders();
        }

        // Fonction pour obtenir l'élément après lequel insérer un topic lors du drag
        function getDragAfterElementForTopics(container, y) {
            const draggableElements = [...container.querySelectorAll(':scope > .array-item.section-topic:not(.dragging)')];

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

        // Fonction pour obtenir l'élément après lequel insérer un quizz lors du drag
        function getDragAfterElementForQuizzes(container, y) {
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

        // Configure le drag & drop pour réordonner les topics
        function setupTopicDragAndDrop(topicDiv) {
            topicDiv.draggable = topicDiv.classList.contains('collapsed');

            topicDiv.addEventListener('dragstart', function(e) {
                // Ne pas interférer avec les drags internes (quizz, choix)
                if (e.target !== topicDiv && (e.target.closest('.section-action') || e.target.closest('.section-feedback'))) {
                    return;
                }
                if (!topicDiv.classList.contains('collapsed')) {
                    e.preventDefault();
                    return;
                }
                topicDiv.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            topicDiv.addEventListener('dragend', function() {
                topicDiv.classList.remove('dragging');
            });
        }

        // Configure les événements de drop sur le conteneur de topics
        function setupTopicsContainerDrop() {
            const container = document.getElementById('topics-container');
            if (!container) return;
            
            // Retirer les anciens listeners si présents
            if (container._dragoverHandler) {
                container.removeEventListener('dragover', container._dragoverHandler);
                container.removeEventListener('drop', container._dropHandler);
            }
            
            container._dragoverHandler = function(e) {
                e.preventDefault();
                const dragging = document.querySelector('.array-item.section-topic.dragging');
                if (!dragging) return;
                
                const afterElement = getDragAfterElementForTopics(container, e.clientY);
                
                if (afterElement == null) {
                    container.appendChild(dragging);
                } else {
                    container.insertBefore(dragging, afterElement);
                }
            };

            container._dropHandler = function(e) {
                e.preventDefault();
                const dragging = document.querySelector('.array-item.section-topic.dragging');
                if (!dragging) return;
                
                reorderTopicsInModel();
                updatetopicsIndexes();
            };
            
            container.addEventListener('dragover', container._dragoverHandler);
            container.addEventListener('drop', container._dropHandler);
        }

        // Configure le drag & drop pour réordonner les quizz (draggable uniquement quand replié)
        function setupQuizzDragAndDrop(quizzDiv, topicIndex) {
            quizzDiv.draggable = quizzDiv.classList.contains('collapsed');

            quizzDiv.addEventListener('dragstart', function(e) {
                // Ne pas interférer avec les drags internes (choix)
                if (e.target && e.target.closest('.section-feedback')) {
                    return;
                }
                if (!quizzDiv.classList.contains('collapsed')) {
                    e.preventDefault();
                    return;
                }
                quizzDiv.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            quizzDiv.addEventListener('dragend', function() {
                quizzDiv.classList.remove('dragging');
            });
        }

        // Configure les événements de drop sur le conteneur de quizz
        function setupQuizzesContainerDrop(topicIndex) {
            const container = document.getElementById(`quizzes-container-${topicIndex}`);
            if (!container) return;
            
            // Retirer les anciens listeners si présents
            container.removeEventListener('dragover', container._dragoverHandler);
            container.removeEventListener('drop', container._dropHandler);
            container.removeEventListener('dragleave', container._dragleaveHandler);
            
            container._dragoverHandler = function(e) {
                e.preventDefault();
                const afterElement = getDragAfterElementForQuizzes(container, e.clientY);
                const dragging = document.querySelector('.array-item.section-action.dragging');
                if (!dragging) return;
                
                if (afterElement == null) {
                    container.appendChild(dragging);
                } else {
                    container.insertBefore(dragging, afterElement);
                }
            };
            
            container._dropHandler = function(e) {
                e.preventDefault();
                // Réorganiser le modèle jsonData selon le nouvel ordre DOM
                reorderQuizzesInModel(topicIndex);
                // Réindexer proprement
                updateQuizzesIndexes(topicIndex);
            };
            
            container._dragleaveHandler = function(e) {
                // Pas d'action nécessaire
            };
            
            container.addEventListener('dragover', container._dragoverHandler);
            container.addEventListener('drop', container._dropHandler);
            container.addEventListener('dragleave', container._dragleaveHandler);
        }

        // Réorganise le tableau jsonData.process.topics selon l'ordre DOM actuel
        function reorderTopicsInModel() {
            const container = document.getElementById('topics-container');
            if (!container) return;
            
            const topicElements = Array.from(container.children);
            const currentTopics = jsonData.process.topics || [];
            const newTopicsOrder = [];
            
            topicElements.forEach(topicDiv => {
                const tmpInput = topicDiv.querySelector('input[name$=".topicID"]');
                const tmpIdValue = tmpInput ? tmpInput.value : undefined;
                if (!tmpIdValue) return;

                const topicData = currentTopics.find(topic => String(topic.topicID) === String(tmpIdValue));
                if (topicData) {
                    newTopicsOrder.push(topicData);
                }
            });
            
            newTopicsOrder.forEach((topicData, idx) => {
                topicData.topicID = idx + 1;
            });

            jsonData.process.topics = newTopicsOrder;
        }

        // Fonction pour obtenir l'élément après lequel insérer un choix lors du drag
        function getDragAfterElementForChoices(container, y) {
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

        // Configure le drag & drop pour un choix (feedback)
        function setupChoiceDragAndDrop(choiceDiv, topicIndex, quizzIndex) {
            choiceDiv.draggable = true;

            choiceDiv.addEventListener('dragstart', function(e) {
                e.stopPropagation();
                e.dataTransfer.setData('text/plain', 'choice-drag');
                choiceDiv.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            choiceDiv.addEventListener('dragend', function() {
                choiceDiv.classList.remove('dragging');
            });

            choiceDiv.addEventListener('mousedown', function(e) {
                e.stopPropagation();
            });
        }

        // Configure les événements de drop sur le conteneur des choix (feedbacks)
        function setupChoicesContainerDrop(topicIndex, quizzIndex) {
            const container = document.getElementById(`feedbacks-container-${topicIndex}-${quizzIndex}`);
            if (!container) return;

            container.removeEventListener('dragover', container._dragoverHandler);
            container.removeEventListener('drop', container._dropHandler);
            container.removeEventListener('dragleave', container._dragleaveHandler);

            container._dragoverHandler = function(e) {
                e.preventDefault();
                const afterElement = getDragAfterElementForChoices(container, e.clientY);
                const dragging = document.querySelector('.array-item.section-feedback.dragging');
                if (!dragging) return;

                if (afterElement == null) {
                    container.appendChild(dragging);
                } else {
                    container.insertBefore(dragging, afterElement);
                }
            };

            container._dropHandler = function(e) {
                e.preventDefault();
                reorderChoicesInModel(topicIndex, quizzIndex);
                updateFeedbacksIndexes(topicIndex, quizzIndex);
            };

            container._dragleaveHandler = function(e) {
                // no-op
            };

            container.addEventListener('dragover', container._dragoverHandler);
            container.addEventListener('drop', container._dropHandler);
            container.addEventListener('dragleave', container._dragleaveHandler);
        }

        // Réorganise jsonData.process.topics[topicIndex].quizzes[quizzIndex].quizChoices selon l'ordre DOM
        function reorderChoicesInModel(topicIndex, quizzIndex) {
            const container = document.getElementById(`feedbacks-container-${topicIndex}-${quizzIndex}`);
            const quizz = jsonData.process.topics[topicIndex]?.quizzes[quizzIndex];
            if (!container || !quizz) return;

            const choiceElements = Array.from(container.children);
            const currentChoices = quizz.quizChoices || [];
            const newOrder = [];

            choiceElements.forEach(choiceDiv => {
                const idInput = choiceDiv.querySelector('input[name$=".choiceID"]');
                const idValue = idInput ? idInput.value : undefined;
                if (!idValue) return;
                const choiceData = currentChoices.find(c => String(c.choiceID) === String(idValue));
                if (choiceData) newOrder.push(choiceData);
            });

            // Ne pas modifier choiceID - c'est un identifiant unique permanent
            // Seul 'numero' change selon l'ordre
            newOrder.forEach((c, idx) => {
                c.numero = idx + 1;
            });
            quizz.quizChoices = newOrder;
        }

        function reorderQuizzIndicatorsInModel(topicIndex, quizzIndex) {
            const container = document.getElementById(`quizz-indicators-container-${topicIndex}-${quizzIndex}`);
            const quizz = jsonData.process.topics[topicIndex]?.quizzes[quizzIndex];
            if (!container || !quizz) return;

            const indicatorElements = Array.from(container.children);
            const newOrder = [];

            indicatorElements.forEach(card => {
                const prefabElem = card.querySelector(`input[id^="quizzIndicatorPrefab-"]`);
                let prefabValue = [];
                try {
                    prefabValue = prefabElem ? JSON.parse(prefabElem.value) : [];
                } catch (e) {
                    prefabValue = [];
                }

                const scale = card.querySelector(`input[name$=".indicatorPrefabScale"]`)?.value || "1";
                const posX = parseInt(card.querySelector(`input[name$=".indicatorPos.x"]`)?.value) || 0;
                const posY = parseInt(card.querySelector(`input[name$=".indicatorPos.y"]`)?.value) || 0;
                const posZ = parseInt(card.querySelector(`input[name$=".indicatorPos.z"]`)?.value) || 0;
                const rotX = parseInt(card.querySelector(`input[name$=".indicatorRot.x"]`)?.value) || 0;
                const rotY = parseInt(card.querySelector(`input[name$=".indicatorRot.y"]`)?.value) || 0;
                const rotZ = parseInt(card.querySelector(`input[name$=".indicatorRot.z"]`)?.value) || 0;

                newOrder.push({
                    indicatorPrefab: prefabValue,
                    indicatorPrefabScale: scale,
                    indicatorPos: { x: posX, y: posY, z: posZ },
                    indicatorRot: { x: rotX, y: rotY, z: rotZ }
                });
            });

            quizz.quizIndicators = newOrder;
        }

        // Réorganise jsonData.process.topics[topicIndex].quizzes selon l'ordre DOM actuel
        function reorderQuizzesInModel(topicIndex) {
            const container = document.getElementById(`quizzes-container-${topicIndex}`);
            if (!container) return;
            
            const quizzElements = Array.from(container.children);
            const newQuizzesOrder = [];
            
            quizzElements.forEach(quizzDiv => {
                // Extraire l'ancien index depuis l'ID ou les champs name
                const titleInput = quizzDiv.querySelector('textarea[name*="].quizQuestion"]');
                if (titleInput) {
                    const match = titleInput.name.match(/quizz\[\d+\]\[(\d+)\]/);
                    if (match) {
                        const oldIndex = parseInt(match[1]);
                        const quizzData = jsonData.process.topics[topicIndex].quizzes[oldIndex];
                        if (quizzData) {
                            newQuizzesOrder.push(quizzData);
                        }
                    }
                }
            });
            
            // Remplacer l'ancien tableau par le nouvel ordre
            jsonData.process.topics[topicIndex].quizzes = newQuizzesOrder;
        }

        function moveQuizzInTopic(topicIndex, quizzIndex, direction) {
            const quizzesContainer = document.getElementById(`quizzes-container-${topicIndex}`);
            if (!quizzesContainer) return;

            const quizzes = Array.from(quizzesContainer.children);
            const currentIndex = quizzes.findIndex(quizz => quizz.id === `quizz-${topicIndex}-${quizzIndex}`);
            if (currentIndex < 0) return;

            const targetIndex = currentIndex + direction;
            if (targetIndex < 0 || targetIndex >= quizzes.length) return;

            const currentQuizz = quizzes[currentIndex];
            if (direction < 0) {
                quizzesContainer.insertBefore(currentQuizz, quizzes[targetIndex]);
            } else {
                quizzesContainer.insertBefore(currentQuizz, quizzes[targetIndex].nextSibling);
            }

            reorderQuizzesInModel(topicIndex);
            updateQuizzesIndexes(topicIndex);
        }

        function moveFeedbackInQuizz(topicIndex, quizzIndex, feedbackIndex, direction) {
            const feedbacksContainer = document.getElementById(`feedbacks-container-${topicIndex}-${quizzIndex}`);
            if (!feedbacksContainer) return;

            const feedbacks = Array.from(feedbacksContainer.children);
            const currentIndex = feedbacks.findIndex(fb => fb.id === `feedback-${topicIndex}-${quizzIndex}-${feedbackIndex}`);
            if (currentIndex < 0) return;

            const targetIndex = currentIndex + direction;
            if (targetIndex < 0 || targetIndex >= feedbacks.length) return;

            const currentFeedback = feedbacks[currentIndex];
            if (direction < 0) {
                feedbacksContainer.insertBefore(currentFeedback, feedbacks[targetIndex]);
            } else {
                feedbacksContainer.insertBefore(currentFeedback, feedbacks[targetIndex].nextSibling);
            }

            reorderChoicesInModel(topicIndex, quizzIndex);
            updateFeedbacksIndexes(topicIndex, quizzIndex);
        }

        function moveQuizzIndicator(topicIndex, quizzIndex, indicatorIndex, direction) {
            const container = document.getElementById(`quizz-indicators-container-${topicIndex}-${quizzIndex}`);
            if (!container) return;

            const indicators = Array.from(container.children);
            const currentIndex = indicators.findIndex(ind => ind.id === `quizz-indicator-${topicIndex}-${quizzIndex}-${indicatorIndex}`);
            if (currentIndex < 0) return;

            const targetIndex = currentIndex + direction;
            if (targetIndex < 0 || targetIndex >= indicators.length) return;

            const currentIndicator = indicators[currentIndex];
            if (direction < 0) {
                container.insertBefore(currentIndicator, indicators[targetIndex]);
            } else {
                container.insertBefore(currentIndicator, indicators[targetIndex].nextSibling);
            }

            reorderQuizzIndicatorsInModel(topicIndex, quizzIndex);
            updateQuizzIndicatorsIndexes(topicIndex, quizzIndex);
        }

        // Fonction pour ajouter un quizz
        function addquizz(topicIndex) {
            const container = document.getElementById(`quizzes-container-${topicIndex}`);
            const quizzIndex = jsonData.process.topics[topicIndex].quizzes.length;
            const quizzDiv = document.createElement('div');
            quizzDiv.className = 'array-item collapsed section-action';
            quizzDiv.id = `quizz-${topicIndex}-${quizzIndex}`;

            quizzDiv.innerHTML = `
                <div class="array-item-header">
                    <button type="button" class="btn btn-collapse" onclick="toggleCollapse('quizz-${topicIndex}-${quizzIndex}')">
                        ⇵ Réduire/Agrandir
                    </button>
                    <span class="array-item-title" id="quizz-title-display-${topicIndex}-${quizzIndex}">Question ${quizzIndex + 1}</span>
                    <div class="header-controls">
                        <button type="button" class="btn btn-remove" onclick="removequizz(${topicIndex}, ${quizzIndex})">
                            ✕ Supprimer
                        </button>
                        <button type="button" class="stage-item-btn quizz-move-up-btn" title="Monter" onclick="moveQuizzInTopic(${topicIndex}, ${quizzIndex}, -1)">▲</button>
                        <button type="button" class="stage-item-btn quizz-move-down-btn" title="Descendre" onclick="moveQuizzInTopic(${topicIndex}, ${quizzIndex}, 1)">▼</button>
                    </div>
                </div>
                <div class="collapsible-content">
                    <div class="form-row" style="margin-top: 20px;">
                        <div class="form-group" style="flex: 2;">
                            <label>Question (obligatoire)</label>
                            <textarea name="quizz[${topicIndex}][${quizzIndex}].quizQuestion" ></textarea>
                        </div>
                        <div class="form-group" style="flex: 1.5;">
                            <label title="Permet d'apporter des précisions si besoin (optionnel)">Note <span class="icon-color">ℹ️</span></label>
                            <textarea name="quizz[${topicIndex}][${quizzIndex}].quizNote"></textarea>
                        </div>
                        <div class="form-group" style="flex: 0 0 160px;">
                            <label title="ℹ️ Définit l'ordre des réponses proposées dans la question">Ordre</label>
                            <select name="quizz[${topicIndex}][${quizzIndex}].ordered" class="desktop-select-only">
                                <option value="true">Dans l'ordre</option>
                                <option value="false">Aléatoire</option>
                            </select>
                            <div class="custom-select-container mobile-select-only" id="custom-ordered-select-${topicIndex}-${quizzIndex}">
                                <div class="custom-select-trigger" onclick="toggleCustomOrderedDropdown(event, ${topicIndex}, ${quizzIndex})">
                                    <span class="custom-select-text">Dans l'ordre</span>
                                    <span class="custom-select-arrow">▼</span>
                                </div>
                                <div class="custom-select-options">
                                    <div class="custom-option active" data-value="true" onclick="selectCustomOrderedOption(event, ${topicIndex}, ${quizzIndex}, 'true', 'Dans l\'ordre')">Dans l'ordre</div>
                                    <div class="custom-option" data-value="false" onclick="selectCustomOrderedOption(event, ${topicIndex}, ${quizzIndex}, 'false', 'Aléatoire')">Aléatoire</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <h3>Liste des Choix</h3>
                    <div id="feedbacks-container-${topicIndex}-${quizzIndex}" class="array-container"></div>
                    <button type="button" class="btn btn-add center" onclick="addFeedback(${topicIndex}, ${quizzIndex})" style="margin-bottom: 20px;">
                        + Ajouter un choix
                    </button>

                    <div style="margin-top: 16px; margin-bottom: 15px; border: 1px solid var(--grey-mid); border-radius: 6px; padding: 14px 16px;">
                        <h3>Indicateurs additionnels</h3>
                        <p style="margin: 4px 0 14px; text-align: center; color: var(--grey-mid); font-size: 0.9em;">Éléments visuels optionnels positionnés dans l'espace 3D.</p>
                        <div id="quizz-indicators-container-${topicIndex}-${quizzIndex}" class="array-container"></div>
                        <button type="button" class="btn btn-add center" onclick="addQuizzIndicator(${topicIndex}, ${quizzIndex})">
                            + Ajouter un indicateur
                        </button>
                    </div>
                    <div style="display:none;">
                        <h3>Position de l'hologramme</h3>
                        <div class="vector3-group">
                            <div class="form-group">
                                <label>X</label>
                                <span class="vector-value" id="quizzHologramOffsetPosX-${topicIndex}-${quizzIndex}">0</span>
                                <input type="hidden" name="quizz[${topicIndex}][${quizzIndex}].quizzHologramOffsetPos.x" id="quizzHologramOffsetPosXInput-${topicIndex}-${quizzIndex}" value="0">
                            </div>
                            <div class="form-group">
                                <label>Y</label>
                                <span class="vector-value" id="quizzHologramOffsetPosY-${topicIndex}-${quizzIndex}">0</span>
                                <input type="hidden" name="quizz[${topicIndex}][${quizzIndex}].quizzHologramOffsetPos.y" id="quizzHologramOffsetPosYInput-${topicIndex}-${quizzIndex}" value="0">
                            </div>
                            <div class="form-group">
                                <label>Z</label>
                                <span class="vector-value" id="quizzHologramOffsetPosZ-${topicIndex}-${quizzIndex}">0</span>
                                <input type="hidden" name="quizz[${topicIndex}][${quizzIndex}].quizzHologramOffsetPos.z" id="quizzHologramOffsetPosZInput-${topicIndex}-${quizzIndex}" value="0">
                            </div>
                        </div>
                        
                        <h3>Rotation de l'hologramme</h3>
                        <div class="vector3-group">
                            <div class="form-group">
                                <label>X</label>
                                <span class="vector-value" id="quizzHologramOffsetRotX-${topicIndex}-${quizzIndex}">0</span>
                                <input type="hidden" name="quizz[${topicIndex}][${quizzIndex}].quizzHologramOffsetRot.x" id="quizzHologramOffsetRotXInput-${topicIndex}-${quizzIndex}" value="0">
                            </div>
                            <div class="form-group">
                                <label>Y</label>
                                <span class="vector-value" id="quizzHologramOffsetRotY-${topicIndex}-${quizzIndex}">0</span>
                                <input type="hidden" name="quizz[${topicIndex}][${quizzIndex}].quizzHologramOffsetRot.y" id="quizzHologramOffsetRotYInput-${topicIndex}-${quizzIndex}" value="0">
                            </div>
                            <div class="form-group">
                                <label>Z</label>
                                <span class="vector-value" id="quizzHologramOffsetRotZ-${topicIndex}-${quizzIndex}">0</span>
                                <input type="hidden" name="quizz[${topicIndex}][${quizzIndex}].quizzHologramOffsetRot.z" id="quizzHologramOffsetRotZInput-${topicIndex}-${quizzIndex}" value="0">
                            </div>
                        </div>
                    </div>
                </div>
            `;

            container.appendChild(quizzDiv);

            // Activer le drag & drop pour ce quizz
            setupQuizzDragAndDrop(quizzDiv, topicIndex);
            
            // Configurer le drop sur le conteneur (une seule fois lors du premier quizz)
            if (quizzIndex === 0 || !container._dropHandler) {
                setupQuizzesContainerDrop(topicIndex);
            }

            // Gestionnaires de texte pour cette quizz
            var quizzDisplay = document.getElementById(`quizz-title-display-${topicIndex}-${quizzIndex}`);
            var quizzInput = document.querySelector(`input[name="quizz[${topicIndex}][${quizzIndex}].quizQuestion"]`);
            if (quizzDisplay) {
                quizzDisplay.innerHTML = `<b>Question ${quizzIndex + 1}${quizzInput && quizzInput.value ? ' | </b>' + quizzInput.value : ''}`;
            }
            if (quizzInput && quizzDisplay) {
                quizzInput.addEventListener('input', function (e) {
                    quizzDisplay.innerHTML = `<b>Question ${quizzIndex + 1}${e.target.value ? ' | </b>' + e.target.value : ''}`;
                });
            }

            // Vérification de l'existence des éléments de fichier avant d'ajouter les écouteurs d'événements
            const quizzImgInput = document.getElementById(`quizzImg-${topicIndex}-${quizzIndex}`);
            const quizzHologramInput = document.getElementById(`quizzHologram-${topicIndex}-${quizzIndex}`);
            const quizzAudioInput = document.getElementById(`quizzAudio-${topicIndex}-${quizzIndex}`);

            if (quizzImgInput) {
                quizzImgInput.addEventListener('change', function (e) {
                    if (e.target.files.length > 0) {
                        const targetInput = document.querySelector(`input[name="quizz[${topicIndex}][${quizzIndex}].quizzImg"]`);
                        if (targetInput) targetInput.value = e.target.files[0].name;
                    }
                });
            }

            if (quizzHologramInput) {
                quizzHologramInput.addEventListener('change', function (e) {
                    if (e.target.files.length > 0) {
                        const targetInput = document.querySelector(`input[name="quizz[${topicIndex}][${quizzIndex}].quizzHologram"]`);
                        if (targetInput) targetInput.value = e.target.files[0].name;
                    }
                });
            }

            if (quizzAudioInput) {
                quizzAudioInput.addEventListener('change', function (e) {
                    if (e.target.files.length > 0) {
                        const targetInput = document.querySelector(`input[name="quizz[${topicIndex}][${quizzIndex}].quizzAudio"]`);
                        if (targetInput) targetInput.value = e.target.files[0].name;
                    }
                });
            }

            if (!jsonData.process.topics[topicIndex].quizzes) {
                jsonData.process.topics[topicIndex].quizzes = [];
            }

            jsonData.process.topics[topicIndex].quizzes.push({
                quizQuestion: "",
                quizNote: "",
                quizIndicators: [],
                choiceID: quizzIdCounter++,
                quizzImg: "",
                feedbackItemTemplateID: 0,
                quizzHologram: "",
                quizzHologramOffsetPos: { x: 0, y: 0, z: 0 },
                quizzHologramOffsetRot: { x: 0, y: 0, z: 0 },
                quizzAudioText: "",
                quizzAudio: "",
                audioIsComment: true,
                quizChoices: []
            });


            // Mise à jour dynamique du titre dans le header du Quizz
            var display = document.getElementById(`quizz-title-display-${topicIndex}-${quizzIndex}`);
            var input = document.querySelector(`textarea[name="quizz[${topicIndex}][${quizzIndex}].quizQuestion"]`);
            if (input && display) {
                input.addEventListener('input', function (e) {
                    display.innerHTML = `<b>Question ${quizzIndex + 1}${e.target.value ? ' |</b> ' + escapeHtml(e.target.value) : ''}`;
                    // Synchronise le modèle
                    jsonData.process.topics[topicIndex].quizzes[quizzIndex].quizQuestion = e.target.value;
                });
            }
        }

        // Fonction pour ajouter une réponse (feedback)
        function addFeedback(topicIndex, quizzIndex) {
            const container = document.getElementById(`feedbacks-container-${topicIndex}-${quizzIndex}`);
            const feedbackIndex = jsonData.process.topics[topicIndex].quizzes[quizzIndex].quizChoices.length;
            const feedbackDiv = document.createElement('div');
            feedbackDiv.className = 'array-item collapsed section-feedback';
            feedbackDiv.id = `feedback-${topicIndex}-${quizzIndex}-${feedbackIndex}`;

            // Récupérer le premier indicateur du Quizz pour appliquer son prefab au nouveau feedback
            const quizzPrefabArray = getPrimaryQuizzIndicatorPrefab(topicIndex, quizzIndex);
            // Vérifier si un indicateur est réellement configuré (pas juste un fallback par défaut)
            const hasConfiguredIndicator = quizzPrefabArray.length > 0 && getQuizzIndicatorCard(topicIndex, quizzIndex, 0) !== null;
            const quizzType = hasConfiguredIndicator ? (quizzPrefabArray[0] || '') : '';
            const quizzDirection = hasConfiguredIndicator ? (quizzPrefabArray[1] || '') : '';
            const quizzOrientation = hasConfiguredIndicator ? (quizzPrefabArray[2] || '') : '';
            const quizzHasDistance = hasConfiguredIndicator && quizzPrefabArray.includes('distance');

            // Déterminer quels boutons sont actifs dans le HTML
            const typeActiveClass = {
                zone: quizzType === 'zone' ? ' active' : '',
                niveau: quizzType === 'niveau' ? ' active' : '',
                aplomb: quizzType === 'aplomb' ? ' active' : '',
                point: quizzType === 'point' ? ' active' : ''
            };

            const directionInActive = (quizzType === 'point' && quizzDirection === 'in') ? ' active' : '';
            const directionOutActive = (quizzType === 'point' && quizzDirection === 'out') ? ' active' : '';
            const orientationVertActive = (quizzType === 'point' && quizzOrientation === 'vertical') ? ' active' : '';
            const orientationHorActive = (quizzType === 'point' && quizzOrientation === 'horizontal') ? ' active' : '';
            const distanceText = quizzHasDistance ? 'Oui' : 'Non';
            const distanceOption = quizzHasDistance ? 'oui' : 'non';
            const distanceActive = quizzHasDistance ? ' active' : '';
            const optionsDisplay = quizzType === 'point' ? 'flex' : 'none';
            const prefabToStore = hasConfiguredIndicator ? quizzPrefabArray : [];
            
            // Générer un choiceID unique basé sur timestamp (pure entier)
            const uniqueChoiceID = generateUniqueID();

            feedbackDiv.innerHTML = `
                <div class="array-item-header">
                    <button type="button" class="btn btn-collapse" onclick="toggleCollapse('feedback-${topicIndex}-${quizzIndex}-${feedbackIndex}')">
                        ⇵ Réduire/Agrandir
                    </button>
                    <span class="array-item-title" id="feedback-title-display-${topicIndex}-${quizzIndex}-${feedbackIndex}">Choix ${feedbackIndex + 1}</span>
                    <div class="header-controls">
                        <button type="button" class="btn btn-remove" onclick="removeFeedback(${topicIndex}, ${quizzIndex}, ${feedbackIndex})">
                            ✕ Supprimer
                        </button>
                        <button type="button" class="stage-item-btn feedback-move-up-btn" title="Monter" onclick="moveFeedbackInQuizz(${topicIndex}, ${quizzIndex}, ${feedbackIndex}, -1)">▲</button>
                        <button type="button" class="stage-item-btn feedback-move-down-btn" title="Descendre" onclick="moveFeedbackInQuizz(${topicIndex}, ${quizzIndex}, ${feedbackIndex}, 1)">▼</button>
                    </div>
                </div>

                <div class="collapsible-content">

                <input type="hidden" name="feedback[${topicIndex}][${quizzIndex}][${feedbackIndex}].choiceID" value="${uniqueChoiceID}">
                <input type="hidden" name="feedback[${topicIndex}][${quizzIndex}][${feedbackIndex}].feedbackPrefab" id="feedbackPrefab-${topicIndex}-${quizzIndex}-${feedbackIndex}" value='${JSON.stringify(prefabToStore)}'>

                <div class="feedback-row-flex" style="display: flex; gap: 15px; margin-top: 15px;">
                    <div class="form-group" style="flex: 1.5; margin-top: 0;">
                        <label>Titre</label>
                        <input type="text" name="feedback[${topicIndex}][${quizzIndex}][${feedbackIndex}].choice" value="">
                    </div>
                    <div class="form-group" style="flex: 3; margin-top: 0;">
                        <label>Réponse</label>
                        <textarea name="feedback[${topicIndex}][${quizzIndex}][${feedbackIndex}].answer"></textarea>
                    </div>
                    <div class="status-order-container">
                        <div class="form-group" style="flex: 0 0 120px; margin-top: 0;">
                            <label>Statut</label>
                            <select name="feedback[${topicIndex}][${quizzIndex}][${feedbackIndex}].correct">
                                <option value="true">Vrai</option>
                                <option value="false">Faux</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="indicator-grid" style="display: grid; grid-template-columns: 1.8fr 0.8fr 1.5fr; gap: 20px; margin-top: 20px; margin-bottom: 15px; align-items: flex-start;">
                    <div style="display: flex; flex-direction: column; gap: 8px; flex: 2;">
                        <label style="margin: 0;" title="Type de marqueur 3D affiché lors du feedback">Type d'indicateur <span class="icon-color">ℹ️</span></label>
                        <div class="flex-wrap-gap-8" style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <button type="button" class="feedback-type-btn${typeActiveClass.zone}" data-type="zone" onclick="updateFeedbackType(${topicIndex}, ${quizzIndex}, ${feedbackIndex}, 'zone')">Zone</button>
                            <button type="button" class="feedback-type-btn${typeActiveClass.niveau}" data-type="niveau" onclick="updateFeedbackType(${topicIndex}, ${quizzIndex}, ${feedbackIndex}, 'niveau')">Niveau</button>
                            <button type="button" class="feedback-type-btn${typeActiveClass.aplomb}" data-type="aplomb" onclick="updateFeedbackType(${topicIndex}, ${quizzIndex}, ${feedbackIndex}, 'aplomb')">Aplomb</button>
                            <button type="button" class="feedback-type-btn${typeActiveClass.point}" data-type="point" onclick="updateFeedbackType(${topicIndex}, ${quizzIndex}, ${feedbackIndex}, 'point')">Point</button>
                            <button type="button" class="feedback-type-btn btn-clear-indicator" id="clear-feedback-indicator-${topicIndex}-${quizzIndex}-${feedbackIndex}" onclick="clearFeedbackType(${topicIndex}, ${quizzIndex}, ${feedbackIndex})" style="display: ${quizzType ? 'inline-block' : 'none'};">✕ Annuler</button>
                        </div>
                        <div id="feedback-options-${topicIndex}-${quizzIndex}-${feedbackIndex}" style="display: ${optionsDisplay}; flex-wrap: wrap; gap: 25px; margin-top: 8px; align-items: flex-start;">
                            <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 8px;">
                                <label style="margin: 0; font-size: 0.9em;">Direction</label>
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <button type="button" class="feedback-option-btn-small${directionInActive}" data-option="in" onclick="updateFeedbackDirection(${topicIndex}, ${quizzIndex}, ${feedbackIndex}, 'in')">In</button>
                                    <button type="button" class="feedback-option-btn-small${directionOutActive}" data-option="out" onclick="updateFeedbackDirection(${topicIndex}, ${quizzIndex}, ${feedbackIndex}, 'out')">Out</button>
                                </div>
                            </div>
                            <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 8px;">
                                <label style="margin: 0; font-size: 0.9em;">Orientation</label>
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <button type="button" class="feedback-option-btn-small${orientationVertActive}" data-option="vertical" onclick="updateFeedbackOrientation(${topicIndex}, ${quizzIndex}, ${feedbackIndex}, 'vertical')">Vertical</button>
                                    <button type="button" class="feedback-option-btn-small${orientationHorActive}" data-option="horizontal" onclick="updateFeedbackOrientation(${topicIndex}, ${quizzIndex}, ${feedbackIndex}, 'horizontal')">Horizontal</button>
                                </div>
                            </div>
                            <div style="display: none; flex-direction: column; align-items: flex-start; gap: 8px;">
                                <label style="margin: 0; font-size: 0.9em;">Distance</label>
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <button type="button" class="feedback-option-btn-small${distanceActive}" id="distance-btn-${topicIndex}-${quizzIndex}-${feedbackIndex}" data-option="${distanceOption}" onclick="toggleFeedbackDistance(${topicIndex}, ${quizzIndex}, ${feedbackIndex})">${distanceText}</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="scale-posrot-wrapper">
                        <div style="display: flex; flex-direction: column; gap: 8px; flex: 0.5;">
                            <label style="margin: 0;" title="Taille de l'indicateur (1 = taille normale)">Échelle <span class="icon-color">ℹ️</span></label>
                            <input type="number" name="feedback[${topicIndex}][${quizzIndex}][${feedbackIndex}].feedbackPrefabScale" step="0.1" value="1" style="width: 70px !important; padding: 7px; border: 2px solid var(--input-border); border-radius: 5px; font-size: 0.9em;">
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 8px; flex: 1.5;">
                            <button type="button" class="feedback-type-btn" id="feedback-posrot-toggle-${topicIndex}-${quizzIndex}-${feedbackIndex}" onclick="toggleFeedbackPosRot(${topicIndex}, ${quizzIndex}, ${feedbackIndex})" style="margin: 0; font-weight: 400;">
                                <span class="desktop-inline">Position & rotation</span><span class="mobile-inline">Pos & Rot</span> ▼
                            </button>
                            <div id="feedback-posrot-content-${topicIndex}-${quizzIndex}-${feedbackIndex}" style="display: none; flex-direction: column; gap: 12px;">
                                <label style="margin: 0;">Position</label>
                                <div class="pos-rot-inputs" style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                                    <label style="margin: 0; font-size: 0.85em;">X</label>
                                    <input type="number" name="feedback[${topicIndex}][${quizzIndex}][${feedbackIndex}].feedbackPos.x" step="1" value="0" style="width: 60px; padding: 7px; border: 2px solid var(--input-border); border-radius: 5px; font-size: 0.9em;">
                                    <label style="margin: 0; font-size: 0.85em;">Y</label>
                                    <input type="number" name="feedback[${topicIndex}][${quizzIndex}][${feedbackIndex}].feedbackPos.y" step="1" value="0" style="width: 60px; padding: 7px; border: 2px solid var(--input-border); border-radius: 5px; font-size: 0.9em;">
                                    <label style="margin: 0; font-size: 0.85em;">Z</label>
                                    <input type="number" name="feedback[${topicIndex}][${quizzIndex}][${feedbackIndex}].feedbackPos.z" step="1" value="0" style="width: 60px; padding: 7px; border: 2px solid var(--input-border); border-radius: 5px; font-size: 0.9em;">
                                </div>
                                <label style="margin: 0;">Rotation</label>
                                <div class="pos-rot-inputs" style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                                    <label style="margin: 0; font-size: 0.85em;">X</label>
                                    <input type="number" name="feedback[${topicIndex}][${quizzIndex}][${feedbackIndex}].feedbackRot.x" step="any" value="0" style="width: 60px; padding: 7px; border: 2px solid var(--input-border); border-radius: 5px; font-size: 0.9em;">
                                    <label style="margin: 0; font-size: 0.85em;">Y</label>
                                    <input type="number" name="feedback[${topicIndex}][${quizzIndex}][${feedbackIndex}].feedbackRot.y" step="any" value="0" style="width: 60px; padding: 7px; border: 2px solid var(--input-border); border-radius: 5px; font-size: 0.9em;">
                                    <label style="margin: 0; font-size: 0.85em;">Z</label>
                                    <input type="number" name="feedback[${topicIndex}][${quizzIndex}][${feedbackIndex}].feedbackRot.z" step="any" value="0" style="width: 60px; padding: 7px; border: 2px solid var(--input-border); border-radius: 5px; font-size: 0.9em;">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>


                </div>
            `;

            container.appendChild(feedbackDiv);

            // Activer le drag & drop sur ce choix et son conteneur
            setupChoiceDragAndDrop(feedbackDiv, topicIndex, quizzIndex);
            if (feedbackIndex === 0 || !container._dropHandler) {
                setupChoicesContainerDrop(topicIndex, quizzIndex);
            }

            // Mise à jour dynamique du titre dans le header du feedback
            updateFeedbackDisplayTitle(topicIndex, quizzIndex, feedbackIndex);

            // Ajouter event listener pour le champ "Choix"
            const choiceInput = feedbackDiv.querySelector(`input[name="feedback[${topicIndex}][${quizzIndex}][${feedbackIndex}].choice"]`);
            const choiceDisplay = document.getElementById(`feedback-title-display-${topicIndex}-${quizzIndex}-${feedbackIndex}`);
            if (choiceInput && choiceDisplay) {
                choiceInput.addEventListener('input', function(e) {
                    const choiceValue = e.target.value;
                    updateFeedbackDisplayTitle(topicIndex, quizzIndex, feedbackIndex);
                    
                    // Synchroniser avec le modèle
                    if (jsonData.process.topics[topicIndex]?.quizzes[quizzIndex]?.quizChoices[feedbackIndex]) {
                        jsonData.process.topics[topicIndex].quizzes[quizzIndex].quizChoices[feedbackIndex].choice = choiceValue;
                    }
                });
            }

            if (!jsonData.process.topics[topicIndex].quizzes[quizzIndex].quizChoices) {
                jsonData.process.topics[topicIndex].quizzes[quizzIndex].quizChoices = [];
            }

            jsonData.process.topics[topicIndex].quizzes[quizzIndex].quizChoices.push({
                choiceID: uniqueChoiceID,
                choice: "",
                answer: "",
                correct: "true",
                choiceFeedbacks: {
                    feedbackPrefab: quizzPrefabArray,
                    feedbackPos: { x: 0, y: 0, z: 0 },
                    feedbackRot: { x: 0, y: 0, z: 0 },
                    feedbackPrefabScale: "1"
                },
                numero: feedbackIndex + 1
            });
        }

        // Fonctions pour gérer les indicateurs du Quizz
        function getQuizzIndicatorCard(topicIndex, quizzIndex, indicatorIndex) {
            return document.getElementById(`quizz-indicator-${topicIndex}-${quizzIndex}-${indicatorIndex}`);
        }

        function getPrimaryQuizzIndicatorPrefab(topicIndex, quizzIndex) {
            const firstCard = getQuizzIndicatorCard(topicIndex, quizzIndex, 0);
            if (!firstCard) return [];

            const hiddenInput = firstCard.querySelector(`input[id^="quizzIndicatorPrefab-"]`);
            if (!hiddenInput) return [];

            try {
                const prefabArray = JSON.parse(hiddenInput.value || '[]');
                return Array.isArray(prefabArray) ? prefabArray : [];
            } catch (e) {
                return [];
            }
        }

        function updateQuizzIndicatorDisplayTitle(topicIndex, quizzIndex, indicatorIndex) {
            const display = document.getElementById(`quizz-indicator-title-display-${topicIndex}-${quizzIndex}-${indicatorIndex}`);
            const hiddenInput = document.getElementById(`quizzIndicatorPrefab-${topicIndex}-${quizzIndex}-${indicatorIndex}`);
            if (!display || !hiddenInput) return;

            try {
                const prefabArray = JSON.parse(hiddenInput.value || '[]');
                if (Array.isArray(prefabArray) && prefabArray.length > 0) {
                    const formattedPrefab = prefabArray.map(val => val.charAt(0).toUpperCase() + val.slice(1)).join(' | ');
                    display.innerHTML = `<b>Indicateur ${indicatorIndex + 1} | </b>${formattedPrefab}`;
                } else {
                    display.innerHTML = `<b>Indicateur ${indicatorIndex + 1}</b>`;
                }
            } catch (e) {
                display.innerHTML = `<b>Indicateur ${indicatorIndex + 1}</b>`;
            }
        }

        function applyQuizzIndicatorState(topicIndex, quizzIndex, indicatorIndex, indicatorData) {
            const indicatorCard = getQuizzIndicatorCard(topicIndex, quizzIndex, indicatorIndex);
            if (!indicatorCard) return;

            const prefabArray = Array.isArray(indicatorData.indicatorPrefab) ? indicatorData.indicatorPrefab : [];
            const scale = indicatorData.indicatorPrefabScale ?? '1';
            const pos = indicatorData.indicatorPos || { x: 0, y: 0, z: 0 };
            const rot = indicatorData.indicatorRot || { x: 0, y: 0, z: 0 };

            const hiddenInput = indicatorCard.querySelector(`input[id^="quizzIndicatorPrefab-"]`);
            if (hiddenInput) hiddenInput.value = JSON.stringify(prefabArray);

            const scaleInput = indicatorCard.querySelector(`input[name="quizIndicators[${topicIndex}][${quizzIndex}][${indicatorIndex}].indicatorPrefabScale"]`);
            if (scaleInput) scaleInput.value = scale;

            const posXInput = indicatorCard.querySelector(`input[name="quizIndicators[${topicIndex}][${quizzIndex}][${indicatorIndex}].indicatorPos.x"]`);
            if (posXInput) posXInput.value = pos.x || 0;
            const posYInput = indicatorCard.querySelector(`input[name="quizIndicators[${topicIndex}][${quizzIndex}][${indicatorIndex}].indicatorPos.y"]`);
            if (posYInput) posYInput.value = pos.y || 0;
            const posZInput = indicatorCard.querySelector(`input[name="quizIndicators[${topicIndex}][${quizzIndex}][${indicatorIndex}].indicatorPos.z"]`);
            if (posZInput) posZInput.value = pos.z || 0;

            const rotXInput = indicatorCard.querySelector(`input[name="quizIndicators[${topicIndex}][${quizzIndex}][${indicatorIndex}].indicatorRot.x"]`);
            if (rotXInput) rotXInput.value = rot.x || 0;
            const rotYInput = indicatorCard.querySelector(`input[name="quizIndicators[${topicIndex}][${quizzIndex}][${indicatorIndex}].indicatorRot.y"]`);
            if (rotYInput) rotYInput.value = rot.y || 0;
            const rotZInput = indicatorCard.querySelector(`input[name="quizIndicators[${topicIndex}][${quizzIndex}][${indicatorIndex}].indicatorRot.z"]`);
            if (rotZInput) rotZInput.value = rot.z || 0;

            const type = prefabArray[0] || '';
            indicatorCard.querySelectorAll('.feedback-type-btn[data-type]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.type === type);
            });

            const optionsDiv = indicatorCard.querySelector(`[id^="quizz-indicator-options-"]`);
            if (optionsDiv) optionsDiv.style.display = type === 'point' ? 'flex' : 'none';

            const clearBtn = indicatorCard.querySelector(`[id^="clear-quizz-indicator-"]`);
            if (clearBtn) clearBtn.style.display = type ? 'inline-block' : 'none';

            if (type === 'point') {
                const direction = prefabArray[1] || 'out';
                const orientation = prefabArray[2] || 'horizontal';
                const hasDistance = prefabArray.includes('distance');

                indicatorCard.querySelectorAll('[data-option="in"], [data-option="out"]').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.option === direction);
                });
                indicatorCard.querySelectorAll('[data-option="vertical"], [data-option="horizontal"]').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.option === orientation);
                });

                const distanceBtn = indicatorCard.querySelector(`[id^="quizz-distance-btn-"]`);
                if (distanceBtn) {
                    distanceBtn.dataset.option = hasDistance ? 'oui' : 'non';
                    distanceBtn.textContent = hasDistance ? 'Oui' : 'Non';
                    distanceBtn.classList.toggle('active', hasDistance);
                }
            }

            const quiz = jsonData.process.topics[topicIndex]?.quizzes[quizzIndex];
            if (quiz) {
                if (!Array.isArray(quiz.quizIndicators)) quiz.quizIndicators = [];
                quiz.quizIndicators[indicatorIndex] = {
                    indicatorPrefab: prefabArray,
                    indicatorPrefabScale: scale,
                    indicatorPos: pos,
                    indicatorRot: rot
                };
            }

            updateQuizzIndicatorDisplayTitle(topicIndex, quizzIndex, indicatorIndex);
        }

        function addQuizzIndicator(topicIndex, quizzIndex, indicatorData = {}) {
            const container = document.getElementById(`quizz-indicators-container-${topicIndex}-${quizzIndex}`);
            if (!container) return;

            if (!jsonData.process.topics[topicIndex]?.quizzes[quizzIndex]) return;
            const indicatorIndex = jsonData.process.topics[topicIndex].quizzes[quizzIndex].quizIndicators.length;

            const indicatorDiv = document.createElement('div');
            indicatorDiv.className = 'array-item collapsed section-indicator';
            indicatorDiv.id = `quizz-indicator-${topicIndex}-${quizzIndex}-${indicatorIndex}`;

            indicatorDiv.innerHTML = `
                <div class="array-item-header">
                    <button type="button" class="btn btn-collapse" onclick="toggleCollapse('quizz-indicator-${topicIndex}-${quizzIndex}-${indicatorIndex}')">
                        ⇵ Réduire/Agrandir
                    </button>
                    <span class="array-item-title" id="quizz-indicator-title-display-${topicIndex}-${quizzIndex}-${indicatorIndex}">Indicateur ${indicatorIndex + 1}</span>
                    <div class="header-controls">
                        <button type="button" class="btn btn-remove" onclick="removeQuizzIndicator(${topicIndex}, ${quizzIndex}, ${indicatorIndex})">
                            ✕ Supprimer
                        </button>
                        <button type="button" class="stage-item-btn quizz-indicator-move-up-btn" title="Monter" onclick="moveQuizzIndicator(${topicIndex}, ${quizzIndex}, ${indicatorIndex}, -1)">▲</button>
                        <button type="button" class="stage-item-btn quizz-indicator-move-down-btn" title="Descendre" onclick="moveQuizzIndicator(${topicIndex}, ${quizzIndex}, ${indicatorIndex}, 1)">▼</button>
                    </div>
                </div>
                <div class="collapsible-content">
                    <input type="hidden" id="quizzIndicatorPrefab-${topicIndex}-${quizzIndex}-${indicatorIndex}" name="quizIndicators[${topicIndex}][${quizzIndex}][${indicatorIndex}].indicatorPrefab" value='[]'>

                    <div style="margin-top: 16px; border: 1px solid var(--grey-mid); border-radius: 6px; padding: 14px 16px;">
                        <div class="indicator-grid" style="display: grid; grid-template-columns: 1.8fr 0.8fr 1.5fr; gap: 20px; margin-top: 0; align-items: flex-start;">
                            <div style="display: flex; flex-direction: column; gap: 8px; flex: 2;">
                                <label style="margin: 0;" title="Type de marqueur 3D affiché lors de la question">Type d'indicateur <span class="icon-color">ℹ️</span></label>
                                <div class="flex-wrap-gap-8" style="display: flex; gap: 8px; flex-wrap: wrap;">
                                    <button type="button" class="feedback-type-btn" data-type="zone" onclick="updateQuizzIndicatorType(${topicIndex}, ${quizzIndex}, ${indicatorIndex}, 'zone')">Zone</button>
                                    <button type="button" class="feedback-type-btn" data-type="niveau" onclick="updateQuizzIndicatorType(${topicIndex}, ${quizzIndex}, ${indicatorIndex}, 'niveau')">Niveau</button>
                                    <button type="button" class="feedback-type-btn" data-type="aplomb" onclick="updateQuizzIndicatorType(${topicIndex}, ${quizzIndex}, ${indicatorIndex}, 'aplomb')">Aplomb</button>
                                    <button type="button" class="feedback-type-btn" data-type="point" onclick="updateQuizzIndicatorType(${topicIndex}, ${quizzIndex}, ${indicatorIndex}, 'point')">Point</button>
                                    <button type="button" class="feedback-type-btn btn-clear-indicator" id="clear-quizz-indicator-${topicIndex}-${quizzIndex}-${indicatorIndex}" onclick="clearQuizzIndicatorType(${topicIndex}, ${quizzIndex}, ${indicatorIndex})" style="display: none;">✕ Annuler</button>
                                </div>
                                <div id="quizz-indicator-options-${topicIndex}-${quizzIndex}-${indicatorIndex}" style="display: none; gap: 25px; margin-top: 8px; margin-bottom: 0; flex-wrap: wrap; align-items: flex-start;">
                                    <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 8px;">
                                        <label style="margin: 0; font-size: 0.9em;">Direction</label>
                                        <div style="display: flex; align-items: center; gap: 10px;">
                                            <button type="button" class="feedback-option-btn-small" data-option="in" onclick="updateQuizzIndicatorDirection(${topicIndex}, ${quizzIndex}, ${indicatorIndex}, 'in')">In</button>
                                            <button type="button" class="feedback-option-btn-small" data-option="out" onclick="updateQuizzIndicatorDirection(${topicIndex}, ${quizzIndex}, ${indicatorIndex}, 'out')">Out</button>
                                        </div>
                                    </div>
                                    <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 8px;">
                                        <label style="margin: 0; font-size: 0.9em;">Orientation</label>
                                        <div style="display: flex; align-items: center; gap: 10px;">
                                            <button type="button" class="feedback-option-btn-small" data-option="vertical" onclick="updateQuizzIndicatorOrientation(${topicIndex}, ${quizzIndex}, ${indicatorIndex}, 'vertical')">Vertical</button>
                                            <button type="button" class="feedback-option-btn-small" data-option="horizontal" onclick="updateQuizzIndicatorOrientation(${topicIndex}, ${quizzIndex}, ${indicatorIndex}, 'horizontal')">Horizontal</button>
                                        </div>
                                    </div>
                                    <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 8px;">
                                        <label style="margin: 0; font-size: 0.9em;">Distance</label>
                                        <div style="display: flex; align-items: center; gap: 10px;">
                                            <button type="button" class="feedback-option-btn-small" id="quizz-distance-btn-${topicIndex}-${quizzIndex}-${indicatorIndex}" data-option="non" onclick="toggleQuizzIndicatorDistance(${topicIndex}, ${quizzIndex}, ${indicatorIndex})">Non</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="scale-posrot-wrapper">
                                <div style="display: flex; flex-direction: column; gap: 8px; flex: 0.5;">
                                    <label style="margin: 0;" title="Taille de l'indicateur (1 = taille normale)">Échelle <span class="icon-color">ℹ️</span></label>
                                    <input type="number" name="quizIndicators[${topicIndex}][${quizzIndex}][${indicatorIndex}].indicatorPrefabScale" step="0.1" value="1" style="width: 70px !important; padding: 7px; border: 2px solid var(--input-border); border-radius: 5px; font-size: 0.9em;">
                                </div>
                                <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 8px; flex: 1.5;">
                                    <button type="button" class="feedback-type-btn" id="quizz-posrot-toggle-${topicIndex}-${quizzIndex}-${indicatorIndex}" onclick="toggleQuizzPosRot(${topicIndex}, ${quizzIndex}, ${indicatorIndex})" style="margin: 0; font-weight: 400;">
                                        <span class="desktop-inline">Position & rotation</span><span class="mobile-inline">Pos & Rot</span> ▼
                                    </button>
                                    <div id="quizz-posrot-content-${topicIndex}-${quizzIndex}-${indicatorIndex}" style="display: none; flex-direction: column; gap: 12px;">
                                        <label style="margin: 0;">Position</label>
                                        <div class="pos-rot-inputs" style="display: flex; gap: 8px; align-items: center;">
                                            <label style="margin: 0; font-size: 0.85em;">X</label>
                                            <input type="number" name="quizIndicators[${topicIndex}][${quizzIndex}][${indicatorIndex}].indicatorPos.x" step="1" value="0" style="width: 60px; padding: 7px; border: 2px solid var(--input-border); border-radius: 5px; font-size: 0.9em;">
                                            <label style="margin: 0; font-size: 0.85em;">Y</label>
                                            <input type="number" name="quizIndicators[${topicIndex}][${quizzIndex}][${indicatorIndex}].indicatorPos.y" step="1" value="0" style="width: 60px; padding: 7px; border: 2px solid var(--input-border); border-radius: 5px; font-size: 0.9em;">
                                            <label style="margin: 0; font-size: 0.85em;">Z</label>
                                            <input type="number" name="quizIndicators[${topicIndex}][${quizzIndex}][${indicatorIndex}].indicatorPos.z" step="1" value="0" style="width: 60px; padding: 7px; border: 2px solid var(--input-border); border-radius: 5px; font-size: 0.9em;">
                                        </div>
                                        <label style="margin: 0;">Rotation</label>
                                        <div class="pos-rot-inputs" style="display: flex; gap: 8px; align-items: center;">
                                            <label style="margin: 0; font-size: 0.85em;">X</label>
                                            <input type="number" name="quizIndicators[${topicIndex}][${quizzIndex}][${indicatorIndex}].indicatorRot.x" step="any" value="0" style="width: 60px; padding: 7px; border: 2px solid var(--input-border); border-radius: 5px; font-size: 0.9em;">
                                            <label style="margin: 0; font-size: 0.85em;">Y</label>
                                            <input type="number" name="quizIndicators[${topicIndex}][${quizzIndex}][${indicatorIndex}].indicatorRot.y" step="any" value="0" style="width: 60px; padding: 7px; border: 2px solid var(--input-border); border-radius: 5px; font-size: 0.9em;">
                                            <label style="margin: 0; font-size: 0.85em;">Z</label>
                                            <input type="number" name="quizIndicators[${topicIndex}][${quizzIndex}][${indicatorIndex}].indicatorRot.z" step="any" value="0" style="width: 60px; padding: 7px; border: 2px solid var(--input-border); border-radius: 5px; font-size: 0.9em;">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            container.appendChild(indicatorDiv);

            jsonData.process.topics[topicIndex].quizzes[quizzIndex].quizIndicators.push({
                indicatorPrefab: Array.isArray(indicatorData.indicatorPrefab)
                    ? indicatorData.indicatorPrefab
                    : [],
                indicatorPrefabScale: indicatorData.indicatorPrefabScale || '1',
                indicatorPos: indicatorData.indicatorPos || { x: 0, y: 0, z: 0 },
                indicatorRot: indicatorData.indicatorRot || { x: 0, y: 0, z: 0 }
            });

            applyQuizzIndicatorState(topicIndex, quizzIndex, indicatorIndex, jsonData.process.topics[topicIndex].quizzes[quizzIndex].quizIndicators[indicatorIndex]);
        }

        function removeQuizzIndicator(topicIndex, quizzIndex, indicatorIndex) {
            if (!confirm('⚠️ Voulez-vous vraiment supprimer cet indicateur ?')) return;
            const quiz = jsonData.process.topics[topicIndex]?.quizzes[quizzIndex];
            if (!quiz) return;

            quiz.quizIndicators.splice(indicatorIndex, 1);
            const card = document.getElementById(`quizz-indicator-${topicIndex}-${quizzIndex}-${indicatorIndex}`);
            if (card) card.remove();
            updateQuizzIndicatorsIndexes(topicIndex, quizzIndex);
        }

        function updateQuizzIndicatorsIndexes(topicIndex, quizzIndex) {
            const container = document.getElementById(`quizz-indicators-container-${topicIndex}-${quizzIndex}`);
            if (!container) return;

            const cards = Array.from(container.children);
            cards.forEach((card, indicatorIndex) => {
                card.id = `quizz-indicator-${topicIndex}-${quizzIndex}-${indicatorIndex}`;

                card.querySelectorAll('input[name], textarea[name], select[name]').forEach(elem => {
                    const name = elem.getAttribute('name');
                    if (!name) return;
                    const newName = name.replace(/quizIndicators\[\d+\]\[\d+\]\[\d+\]/g, `quizIndicators[${topicIndex}][${quizzIndex}][${indicatorIndex}]`);
                    elem.setAttribute('name', newName);
                });

                const header = card.querySelector('.array-item-header');
                if (header) {
                    const collapseBtn = header.querySelector('.btn.btn-collapse');
                    if (collapseBtn) collapseBtn.setAttribute('onclick', `toggleCollapse('quizz-indicator-${topicIndex}-${quizzIndex}-${indicatorIndex}')`);
                    const removeBtn = header.querySelector('.btn.btn-remove');
                    if (removeBtn) removeBtn.setAttribute('onclick', `removeQuizzIndicator(${topicIndex}, ${quizzIndex}, ${indicatorIndex})`);
                    const moveUpBtn = header.querySelector('.quizz-indicator-move-up-btn');
                    if (moveUpBtn) moveUpBtn.setAttribute('onclick', `moveQuizzIndicator(${topicIndex}, ${quizzIndex}, ${indicatorIndex}, -1)`);
                    const moveDownBtn = header.querySelector('.quizz-indicator-move-down-btn');
                    if (moveDownBtn) moveDownBtn.setAttribute('onclick', `moveQuizzIndicator(${topicIndex}, ${quizzIndex}, ${indicatorIndex}, 1)`);
                }

                const toggleBtn = card.querySelector(`[id^="quizz-posrot-toggle-"]`);
                if (toggleBtn) {
                    toggleBtn.id = `quizz-posrot-toggle-${topicIndex}-${quizzIndex}-${indicatorIndex}`;
                    toggleBtn.setAttribute('onclick', `toggleQuizzPosRot(${topicIndex}, ${quizzIndex}, ${indicatorIndex})`);
                }

                const posRotContent = card.querySelector(`[id^="quizz-posrot-content-"]`);
                if (posRotContent) posRotContent.id = `quizz-posrot-content-${topicIndex}-${quizzIndex}-${indicatorIndex}`;

                const optionsDiv = card.querySelector(`[id^="quizz-indicator-options-"]`);
                if (optionsDiv) optionsDiv.id = `quizz-indicator-options-${topicIndex}-${quizzIndex}-${indicatorIndex}`;

                const clearBtn = card.querySelector(`[id^="clear-quizz-indicator-"]`);
                if (clearBtn) {
                    clearBtn.id = `clear-quizz-indicator-${topicIndex}-${quizzIndex}-${indicatorIndex}`;
                    clearBtn.setAttribute('onclick', `clearQuizzIndicatorType(${topicIndex}, ${quizzIndex}, ${indicatorIndex})`);
                }

                const distanceBtn = card.querySelector(`[id^="quizz-distance-btn-"]`);
                if (distanceBtn) {
                    distanceBtn.id = `quizz-distance-btn-${topicIndex}-${quizzIndex}-${indicatorIndex}`;
                    distanceBtn.setAttribute('onclick', `toggleQuizzIndicatorDistance(${topicIndex}, ${quizzIndex}, ${indicatorIndex})`);
                }

                card.querySelectorAll('.feedback-type-btn[data-type]').forEach(btn => {
                    const type = btn.dataset.type;
                    btn.setAttribute('onclick', `updateQuizzIndicatorType(${topicIndex}, ${quizzIndex}, ${indicatorIndex}, '${type}')`);
                });

                card.querySelectorAll('.feedback-option-btn-small[data-option="in"], .feedback-option-btn-small[data-option="out"]').forEach(btn => {
                    const direction = btn.dataset.option;
                    btn.setAttribute('onclick', `updateQuizzIndicatorDirection(${topicIndex}, ${quizzIndex}, ${indicatorIndex}, '${direction}')`);
                });

                card.querySelectorAll('.feedback-option-btn-small[data-option="vertical"], .feedback-option-btn-small[data-option="horizontal"]').forEach(btn => {
                    const orientation = btn.dataset.option;
                    btn.setAttribute('onclick', `updateQuizzIndicatorOrientation(${topicIndex}, ${quizzIndex}, ${indicatorIndex}, '${orientation}')`);
                });

                updateQuizzIndicatorDisplayTitle(topicIndex, quizzIndex, indicatorIndex);
            });
        }

        function updateQuizzIndicatorType(topicIndex, quizzIndex, indicatorIndex, type) {
            const indicatorCard = getQuizzIndicatorCard(topicIndex, quizzIndex, indicatorIndex);
            if (!indicatorCard) return;

            indicatorCard.querySelectorAll('.feedback-type-btn[data-type]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.type === type);
            });

            const optionsDiv = indicatorCard.querySelector(`[id^="quizz-indicator-options-"]`);
            if (optionsDiv) optionsDiv.style.display = type === 'point' ? 'flex' : 'none';

            // Si type = point, s'assurer qu'une direction et orientation par défaut sont actives
            if (type === 'point') {
                const hasDirection = indicatorCard.querySelector('[data-option="in"].active, [data-option="out"].active');
                if (!hasDirection) {
                    indicatorCard.querySelectorAll('[data-option="in"], [data-option="out"]').forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.option === 'out');
                    });
                }
                const hasOrientation = indicatorCard.querySelector('[data-option="vertical"].active, [data-option="horizontal"].active');
                if (!hasOrientation) {
                    indicatorCard.querySelectorAll('[data-option="vertical"], [data-option="horizontal"]').forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.option === 'horizontal');
                    });
                }
            }

            const clearBtn = indicatorCard.querySelector(`[id^="clear-quizz-indicator-"]`);
            if (clearBtn) clearBtn.style.display = 'inline-block';

            buildQuizzIndicatorPrefab(topicIndex, quizzIndex, indicatorIndex);
        }

        function clearQuizzIndicatorType(topicIndex, quizzIndex, indicatorIndex) {
            const indicatorCard = getQuizzIndicatorCard(topicIndex, quizzIndex, indicatorIndex);
            if (!indicatorCard) return;

            indicatorCard.querySelectorAll('.feedback-type-btn[data-type]').forEach(btn => {
                btn.classList.remove('active');
            });

            const optionsDiv = indicatorCard.querySelector(`[id^="quizz-indicator-options-"]`);
            if (optionsDiv) optionsDiv.style.display = 'none';

            const clearBtn = indicatorCard.querySelector(`[id^="clear-quizz-indicator-"]`);
            if (clearBtn) clearBtn.style.display = 'none';

            const hiddenInput = indicatorCard.querySelector(`input[id^="quizzIndicatorPrefab-"]`);
            if (hiddenInput) hiddenInput.value = '[]';

            const quiz = jsonData.process.topics[topicIndex]?.quizzes[quizzIndex];
            if (quiz && quiz.quizIndicators && quiz.quizIndicators[indicatorIndex]) {
                quiz.quizIndicators[indicatorIndex].indicatorPrefab = [];
            }

            updateQuizzIndicatorDisplayTitle(topicIndex, quizzIndex, indicatorIndex);
        }

        function toggleQuizzPosRot(topicIndex, quizzIndex, indicatorIndex) {
            const content = document.getElementById(`quizz-posrot-content-${topicIndex}-${quizzIndex}-${indicatorIndex}`);
            const toggleBtn = document.getElementById(`quizz-posrot-toggle-${topicIndex}-${quizzIndex}-${indicatorIndex}`);
            if (!content || !toggleBtn) return;

            const isClosed = content.style.display === 'none' || content.style.display === '';
            content.style.display = isClosed ? 'flex' : 'none';
            const labelText = window.innerWidth <= 900 ? 'Pos & Rot' : 'Position & rotation';
            toggleBtn.textContent = isClosed ? `${labelText} ▲` : `${labelText} ▼`;
        }

        function updateQuizzIndicatorDirection(topicIndex, quizzIndex, indicatorIndex, direction) {
            const indicatorCard = getQuizzIndicatorCard(topicIndex, quizzIndex, indicatorIndex);
            if (!indicatorCard) return;

            indicatorCard.querySelectorAll('[data-option="in"], [data-option="out"]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.option === direction);
            });

            buildQuizzIndicatorPrefab(topicIndex, quizzIndex, indicatorIndex);
        }

        function updateQuizzIndicatorOrientation(topicIndex, quizzIndex, indicatorIndex, orientation) {
            const indicatorCard = getQuizzIndicatorCard(topicIndex, quizzIndex, indicatorIndex);
            if (!indicatorCard) return;

            indicatorCard.querySelectorAll('[data-option="vertical"], [data-option="horizontal"]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.option === orientation);
            });

            buildQuizzIndicatorPrefab(topicIndex, quizzIndex, indicatorIndex);
        }

        function toggleQuizzIndicatorDistance(topicIndex, quizzIndex, indicatorIndex) {
            const btn = document.getElementById(`quizz-distance-btn-${topicIndex}-${quizzIndex}-${indicatorIndex}`);
            if (!btn) return;

            const currentValue = btn.dataset.option;
            const newValue = currentValue === 'non' ? 'oui' : 'non';
            btn.dataset.option = newValue;
            btn.textContent = newValue === 'non' ? 'Non' : 'Oui';

            btn.classList.toggle('active', newValue === 'oui');

            buildQuizzIndicatorPrefab(topicIndex, quizzIndex, indicatorIndex);
        }

        function buildQuizzIndicatorPrefab(topicIndex, quizzIndex, indicatorIndex) {
            const indicatorCard = getQuizzIndicatorCard(topicIndex, quizzIndex, indicatorIndex);
            if (!indicatorCard) return;

            const activeTypeBtn = indicatorCard.querySelector('.feedback-type-btn[data-type].active');
            const type = activeTypeBtn?.dataset.type || '';

            let prefabArray;
            if (!type) {
                prefabArray = [];
            } else if (type === 'point') {
                const direction = indicatorCard.querySelector('[data-option="in"].active, [data-option="out"].active')?.dataset.option || 'out';
                const orientation = indicatorCard.querySelector('[data-option="vertical"].active, [data-option="horizontal"].active')?.dataset.option || 'horizontal';
                const distanceBtn = document.getElementById(`quizz-distance-btn-${topicIndex}-${quizzIndex}-${indicatorIndex}`);
                const hasDistance = distanceBtn?.dataset.option === 'oui';
                prefabArray = [type, direction, orientation];
                if (hasDistance) prefabArray.push('distance');
            } else {
                prefabArray = [type];
            }

            const hiddenInput = indicatorCard.querySelector(`input[id^="quizzIndicatorPrefab-"]`);
            if (hiddenInput) hiddenInput.value = JSON.stringify(prefabArray);

            const quiz = jsonData.process.topics[topicIndex]?.quizzes[quizzIndex];
            if (quiz) {
                if (!Array.isArray(quiz.quizIndicators)) quiz.quizIndicators = [];
                if (!quiz.quizIndicators[indicatorIndex]) {
                    quiz.quizIndicators[indicatorIndex] = {
                        indicatorPrefab: [],
                        indicatorPrefabScale: '1',
                        indicatorPos: { x: 0, y: 0, z: 0 },
                        indicatorRot: { x: 0, y: 0, z: 0 }
                    };
                }
                quiz.quizIndicators[indicatorIndex].indicatorPrefab = prefabArray;
            }

            updateQuizzIndicatorDisplayTitle(topicIndex, quizzIndex, indicatorIndex);
        }

        // Fonctions pour gérer les boutons de feedback
        function updateFeedbackType(topicIndex, quizzIndex, feedbackIndex, type) {
            const feedbackDiv = document.getElementById(`feedback-${topicIndex}-${quizzIndex}-${feedbackIndex}`);
            if (!feedbackDiv) return;

            // Mettre à jour les boutons actifs
            const typeButtons = feedbackDiv.querySelectorAll('.feedback-type-btn');
            typeButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.type === type);
            });

            // Afficher/masquer les options selon le type
            const optionsDiv = document.getElementById(`feedback-options-${topicIndex}-${quizzIndex}-${feedbackIndex}`);
            if (optionsDiv) {
                // Seul "point" affiche les options direction/orientation/distance
                optionsDiv.style.display = type === 'point' ? 'flex' : 'none';
            }

            // Si type = point, s'assurer qu'une direction et orientation par défaut sont actives
            if (type === 'point') {
                const hasDirection = feedbackDiv.querySelector('[data-option="in"].active, [data-option="out"].active');
                if (!hasDirection) {
                    feedbackDiv.querySelectorAll('[data-option="in"], [data-option="out"]').forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.option === 'out');
                    });
                }
                const hasOrientation = feedbackDiv.querySelector('[data-option="vertical"].active, [data-option="horizontal"].active');
                if (!hasOrientation) {
                    feedbackDiv.querySelectorAll('[data-option="vertical"], [data-option="horizontal"]').forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.option === 'horizontal');
                    });
                }
            }

            // Afficher le bouton Annuler
            const clearBtn = document.getElementById(`clear-feedback-indicator-${topicIndex}-${quizzIndex}-${feedbackIndex}`);
            if (clearBtn) {
                clearBtn.style.display = 'inline-block';
            }

            // Construire et mettre à jour le prefab
            buildFeedbackPrefab(topicIndex, quizzIndex, feedbackIndex);
        }

        function clearFeedbackType(topicIndex, quizzIndex, feedbackIndex) {
            const feedbackDiv = document.getElementById(`feedback-${topicIndex}-${quizzIndex}-${feedbackIndex}`);
            if (!feedbackDiv) return;

            // Désactiver tous les boutons de type
            const typeButtons = feedbackDiv.querySelectorAll('.feedback-type-btn');
            typeButtons.forEach(btn => {
                btn.classList.remove('active');
            });

            // Cacher les options
            const optionsDiv = document.getElementById(`feedback-options-${topicIndex}-${quizzIndex}-${feedbackIndex}`);
            if (optionsDiv) {
                optionsDiv.style.display = 'none';
            }

            // Cacher le bouton Annuler
            const clearBtn = document.getElementById(`clear-feedback-indicator-${topicIndex}-${quizzIndex}-${feedbackIndex}`);
            if (clearBtn) {
                clearBtn.style.display = 'none';
            }

            // Mettre à jour le prefab avec un tableau vide
            const hiddenInput = document.getElementById(`feedbackPrefab-${topicIndex}-${quizzIndex}-${feedbackIndex}`);
            if (hiddenInput) {
                hiddenInput.value = '[]';
            }

            // Mettre à jour le modèle
            if (jsonData.process.topics[topicIndex] && 
                jsonData.process.topics[topicIndex].quizzes[quizzIndex] &&
                jsonData.process.topics[topicIndex].quizzes[quizzIndex].quizChoices[feedbackIndex]) {
                if (jsonData.process.topics[topicIndex].quizzes[quizzIndex].quizChoices[feedbackIndex].choiceFeedbacks) {
                    jsonData.process.topics[topicIndex].quizzes[quizzIndex].quizChoices[feedbackIndex].choiceFeedbacks.feedbackPrefab = [];
                }
            }

            // Mettre à jour le titre affiché pour retirer le prefab du header
            updateFeedbackDisplayTitle(topicIndex, quizzIndex, feedbackIndex);
        }

        function toggleFeedbackPosRot(topicIndex, quizzIndex, feedbackIndex) {
            const content = document.getElementById(`feedback-posrot-content-${topicIndex}-${quizzIndex}-${feedbackIndex}`);
            const toggleBtn = document.getElementById(`feedback-posrot-toggle-${topicIndex}-${quizzIndex}-${feedbackIndex}`);
            if (!content || !toggleBtn) return;

            const isClosed = content.style.display === 'none' || content.style.display === '';
            content.style.display = isClosed ? 'flex' : 'none';
            const labelText = window.innerWidth <= 900 ? 'Pos & Rot' : 'Position & rotation';
            toggleBtn.textContent = isClosed ? `${labelText} ▲` : `${labelText} ▼`;
        }

        function updateFeedbackDirection(topicIndex, quizzIndex, feedbackIndex, direction) {
            const feedbackDiv = document.getElementById(`feedback-${topicIndex}-${quizzIndex}-${feedbackIndex}`);
            if (!feedbackDiv) return;

            const directionButtons = feedbackDiv.querySelectorAll('[data-option="in"], [data-option="out"]');
            directionButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.option === direction);
            });

            buildFeedbackPrefab(topicIndex, quizzIndex, feedbackIndex);
        }

        function updateFeedbackOrientation(topicIndex, quizzIndex, feedbackIndex, orientation) {
            const feedbackDiv = document.getElementById(`feedback-${topicIndex}-${quizzIndex}-${feedbackIndex}`);
            if (!feedbackDiv) return;

            const orientationButtons = feedbackDiv.querySelectorAll('[data-option="vertical"], [data-option="horizontal"]');
            orientationButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.option === orientation);
            });

            buildFeedbackPrefab(topicIndex, quizzIndex, feedbackIndex);
        }

        function toggleFeedbackDistance(topicIndex, quizzIndex, feedbackIndex) {
            const btn = document.getElementById(`distance-btn-${topicIndex}-${quizzIndex}-${feedbackIndex}`);
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

            buildFeedbackPrefab(topicIndex, quizzIndex, feedbackIndex);
        }

        function updateFeedbackDistance(topicIndex, quizzIndex, feedbackIndex, distance) {
            const btn = document.getElementById(`distance-btn-${topicIndex}-${quizzIndex}-${feedbackIndex}`);
            if (!btn) return;

            btn.dataset.option = distance;
            btn.textContent = distance === 'non' ? 'Non' : 'Oui';
            
            // Ajouter la classe active quand c'est "Oui", la retirer sinon
            if (distance === 'oui') {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }

            buildFeedbackPrefab(topicIndex, quizzIndex, feedbackIndex);
        }

        function buildFeedbackPrefab(topicIndex, quizzIndex, feedbackIndex) {
            const feedbackDiv = document.getElementById(`feedback-${topicIndex}-${quizzIndex}-${feedbackIndex}`);
            if (!feedbackDiv) return;

            // Récupérer les valeurs sélectionnées
            const type = feedbackDiv.querySelector('.feedback-type-btn[data-type].active')?.dataset.type || '';
            
            let prefabArray;

            if (!type) {
                // Aucun type sélectionné : prefab vide
                prefabArray = [];
            } else if (type === 'point') {
                // Seul "point" utilise direction/orientation/distance
                const direction = feedbackDiv.querySelector('[data-option="in"].active, [data-option="out"].active')?.dataset.option || 'out';
                const orientation = feedbackDiv.querySelector('[data-option="vertical"].active, [data-option="horizontal"].active')?.dataset.option || 'horizontal';
                const distanceBtn = document.getElementById(`distance-btn-${topicIndex}-${quizzIndex}-${feedbackIndex}`);
                const hasDistance = distanceBtn?.dataset.option === 'oui';

                // Construire le tableau prefab: ["point", "out", "horizontal"] ou ["point", "out", "horizontal", "distance"]
                prefabArray = [type, direction, orientation];
                if (hasDistance) {
                    prefabArray.push('distance');
                }
            } else {
                // Pour zone, niveau, aplomb : juste le nom du type
                prefabArray = [type];
            }

            // Mettre à jour l'input hidden (on stocke le tableau en JSON)
            const hiddenInput = document.getElementById(`feedbackPrefab-${topicIndex}-${quizzIndex}-${feedbackIndex}`);
            if (hiddenInput) {
                hiddenInput.value = JSON.stringify(prefabArray);
            }

            // Mettre à jour le JSON
            if (jsonData.process.topics[topicIndex]?.quizzes[quizzIndex]?.quizChoices[feedbackIndex]) {
                if (!jsonData.process.topics[topicIndex].quizzes[quizzIndex].quizChoices[feedbackIndex].choiceFeedbacks) {
                    jsonData.process.topics[topicIndex].quizzes[quizzIndex].quizChoices[feedbackIndex].choiceFeedbacks = {};
                }
                jsonData.process.topics[topicIndex].quizzes[quizzIndex].quizChoices[feedbackIndex].choiceFeedbacks.feedbackPrefab = prefabArray;
            }

            // Mettre à jour le titre affiché
            updateFeedbackDisplayTitle(topicIndex, quizzIndex, feedbackIndex);
        }

        function updateFeedbackDisplayTitle(topicIndex, quizzIndex, feedbackIndex) {
            const display = document.getElementById(`feedback-title-display-${topicIndex}-${quizzIndex}-${feedbackIndex}`);
            const hiddenInput = document.getElementById(`feedbackPrefab-${topicIndex}-${quizzIndex}-${feedbackIndex}`);
            const choiceInput = document.querySelector(`input[name="feedback[${topicIndex}][${quizzIndex}][${feedbackIndex}].choice"]`);
            const choiceValue = escapeHtml(choiceInput?.value?.trim() || '');
            
            if (display && hiddenInput) {
                try {
                    const prefabArray = JSON.parse(hiddenInput.value);
                    const hasPrefab = Array.isArray(prefabArray) && prefabArray.length > 0;
                    const formattedPrefab = hasPrefab
                        ? prefabArray.map(val => {
                            if (val.toLowerCase() === 'ui') return 'Bouton UI';
                            return val.charAt(0).toUpperCase() + val.slice(1);
                        }).join(' | ')
                        : '';

                    if (hasPrefab && choiceValue) {
                        display.innerHTML = `ID${feedbackIndex + 1} | <b>${choiceValue}</b> | </b>${formattedPrefab}<b>`;
                    } else if (hasPrefab) {
                        display.innerHTML = `ID${feedbackIndex + 1} | <b>⚠️ <i>Titre</i></b> | ${formattedPrefab}`;
                    } else if (choiceValue) {
                        display.innerHTML = `ID${feedbackIndex + 1} | <b>${choiceValue}</b> | Bouton UI`;
                    } else {
                        display.innerHTML = `ID${feedbackIndex + 1} | <b>Nouveau choix</b> [⚠️ <i>Titre</i>] `;
                    }
                } catch (e) {
                    // Fallback si le parsing échoue
                    if (choiceValue) {
                        display.innerHTML = `ID${feedbackIndex + 1} | <b>${choiceValue}</b>`;
                    } else {
                        display.innerHTML = `ID${feedbackIndex + 1} | <b>[⚠️ <i>Titre</i>]</b>`;
                    }
                }
            }
        }

        // Fonction pour ajouter un course
        function addcourse() {
            const container = document.getElementById('courses-container');
            const courseIndex = jsonData.process.courses.length;
            const courseDiv = document.createElement('div');
            courseDiv.className = 'array-item collapsed section-course';
            courseDiv.id = `course-${courseIndex}`;

            courseDiv.innerHTML = `
                <div class="array-item-header">
                    <button type="button" class="btn btn-collapse" onclick="toggleCollapse('course-${courseIndex}')">
                        ⇵ Réduire/Agrandir
                    </button>
                    <span class="array-item-title" id="course-title-display-${courseIndex}">Evaluation ${courseIdCounter}</span>
                    <div>
                        <button type="button" class="btn btn-remove" onclick="removecourse(${courseIndex})">
                            ✕ Supprimer
                        </button>
                    </div>
                </div>
                <div class="collapsible-content">
                    <input type="hidden" name="course[${courseIndex}].courseID" value="${courseIdCounter}">
                    
                    <div class="form-row" style="margin-top: 20px;">
                        <div class="form-group">
                            <label title="Nom de l'évaluation affiché dans l'interface">Titre de l'évaluation <span class="icon-color">ℹ️</span></label>
                            <input type="text" name="course[${courseIndex}].courseTitle" placeholder="Exemple : Préparation">
                        </div>
                        <div class="form-group">
                            <label title="Description détaillée du contenu de l'évaluation">Description de l'évaluation <span class="icon-color">ℹ️</span></label>
                            <textarea name="course[${courseIndex}].courseDesc" placeholder="Détails de l'évaluation"></textarea>
                        </div>
                        <div class="form-group">
                            <label title="ID de l'évaluation qui doit être terminée avant celle-ci">Evaluation précédente requise (ID) <span class="icon-color">ℹ️</span></label>
                            <input type="number" name="course[${courseIndex}].courseRequiresCourseID" min="0" value="0">
                        </div>
                    </div>
                    
                    <div class="form-row" style="margin-top: 30px;">
                        <div class="form-group">
                            <input type="hidden" name="course[${courseIndex}].coursePath" id="coursePath-input-${courseIndex}">
                            <div class="course-path-builder" data-course-index="${courseIndex}">
                                <div class="course-path-main-title">Contenu de l'évaluation</div>
                                <div class="course-path-main-subtitle">Organisez votre évaluation à partir de la liste des questionnaires disponibles.<br>Glissez-deposez les vers la colonne de chemin et ordonnez-les.</div>
                                <div class="course-path-columns">
                                    <div class="course-path-column">
                                        <div class="course-path-title">Questionnaires disponibles</div>
                                        <div class="course-topic-list course-topic-list-available" id="courseAvailabletopics-${courseIndex}">
                                            <!-- Topics disponibles injectées en JS -->
                                        </div>
                                    </div>
                                    <div class="course-path-column">
                                        <div class="course-path-title">Organistation de l'évaluation (glisser-déposer ou boutons ▲▼ sur mobile)</div>
                                        <div class="course-topic-list course-topic-list-selected" id="courseSelectedtopics-${courseIndex}">
                                            <!-- Chemin du course injecté en JS -->
                                        </div>
                                        <div class="course-path-help">
                                            Cliquez sur un questionnaire disponible pour l'ajouter. Sur mobile, utilisez ▲▼ pour l'ordre et ✕ pour retirer.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            container.appendChild(courseDiv);

            // Mise à jour dynamique du titre dans le header du course
            var courseDisplay = document.getElementById(`course-title-display-${courseIndex}`);
            var courseInput = document.querySelector(`input[name="course[${courseIndex}].courseTitle"]`);
            if (courseDisplay && courseInput) {
                // Initialisation à la création
                courseDisplay.innerHTML = `<b>Evaluation ${courseIndex + 1}${courseInput.value ? ' | </b>' + courseInput.value : ''}`;  
                // Mise à jour dynamique
                courseInput.addEventListener('input', function (e) {
                    courseDisplay.innerHTML = `<b>Evaluation ${courseIndex + 1}${e.target.value ? ' | </b>' + e.target.value : ''}`;  
                    // Synchronise le modèle si besoin
                    jsonData.process.courses[courseIndex].courseTitle = e.target.value;
                });
            }
            
            // Ajouter le course au modèle JSON
            jsonData.process.courses.push({
                courseID: String(courseIdCounter++),
                courseTitle: "",
                courseDesc: "",
                courseRequiresCourseID: "0",
                coursePath: ""
            });

            // Initialiser l'UI de construction du chemin des Topics pour ce course
            initcoursePathBuilder(courseIndex);
        }

        // Fonctions de suppression
        function removetopic(index) {
            if (!confirm('⚠️ Voulez-vous vraiment supprimer ce Questionnaire ?')) return;

            // Capture l'état complet pour conserver quizzes/feedbacks
            const data = collectFormData();
            const removed = data.process.topics[index];
            if (!removed) return;
            const removedIdNum = parseInt(removed.topicID) || (index + 1);
            data.process.topics.splice(index, 1);

            // Réindexe topicID
            for (let i = 0; i < data.process.topics.length; i++) {
                data.process.topics[i].topicID = i + 1;
            }

            // Met à jour les coursePath: retire l'ID supprimé et décrémente ceux supérieurs
            data.process.courses = (data.process.courses || []).map(course => {
                const parts = (course.coursePath || '').split('.').filter(Boolean);
                const remapped = parts
                    .filter(id => parseInt(id) !== removedIdNum)
                    .map(id => {
                        const n = parseInt(id);
                        return String(n > removedIdNum ? n - 1 : n);
                    });
                return { ...course, coursePath: remapped.join('.') };
            });

            jsonData = data;
            syncTopLevelToModelFromDOM();
            loadDataToForm(jsonData);
            showMessage('Questionnaire supprimé et réindexé');
        }

        function duplicateTopic(index) {
            const data = collectFormData();
            const sourceTopic = data.process.topics[index];
            if (!sourceTopic) return;

            const duplicatedTopic = JSON.parse(JSON.stringify(sourceTopic));
            const sourceTopicId = parseInt(sourceTopic.topicID) || (index + 1);

            data.process.topics.splice(index + 1, 0, duplicatedTopic);

            for (let i = 0; i < data.process.topics.length; i++) {
                data.process.topics[i].topicID = i + 1;
            }

            data.process.courses = (data.process.courses || []).map(course => {
                const parts = (course.coursePath || '').split('.').filter(Boolean);
                const remapped = parts.map(id => {
                    const n = parseInt(id);
                    if (Number.isNaN(n)) return id;
                    return String(n > sourceTopicId ? n + 1 : n);
                });
                return { ...course, coursePath: remapped.join('.') };
            });

            jsonData = data;
            syncTopLevelToModelFromDOM();
            loadDataToForm(jsonData);
            showMessage('Topic dupliqué et réindexé');
        }

        //Fonction pour supprimer une quizz
        function removequizz(topicIndex, quizzIndex) {
            if (!confirm('⚠️ Voulez-vous vraiment supprimer cette Quizz ?')) return;
            if (!jsonData.process.topics[topicIndex]) return;
            jsonData.process.topics[topicIndex].quizzes.splice(quizzIndex, 1);
            const el = document.getElementById(`quizz-${topicIndex}-${quizzIndex}`);
            if (el) el.remove();
            updateQuizzesIndexes(topicIndex);
            showMessage('Question supprimée');
        }

        //Fonction pour supprimer un feedback
        function removeFeedback(topicIndex, quizzIndex, feedbackIndex) {
            if (!confirm('⚠️ Voulez-vous vraiment supprimer ce feedback ?')) return;
            const quizz = jsonData.process.topics[topicIndex]?.quizzes[quizzIndex];
            if (!quizz) return;
            quizz.quizChoices.splice(feedbackIndex, 1);
            const container = document.getElementById(`feedbacks-container-${topicIndex}-${quizzIndex}`);
            if (container && container.children[feedbackIndex]) {
                container.children[feedbackIndex].remove();
            }
            updateFeedbacksIndexes(topicIndex, quizzIndex);
            showMessage('Feedback supprimé');
        }

        //Fonction pour supprimer un course
        function removecourse(index) {
            if (!confirm('⚠️ Voulez-vous vraiment supprimer ce course ?')) return;
            const data = collectFormData();
            if (!data.process.courses[index]) return;
            data.process.courses.splice(index, 1);

            // Réindexe courseID
            for (let i = 0; i < data.process.courses.length; i++) {
                data.process.courses[i].courseID = String(i + 1);
            }

            jsonData = data;
            syncTopLevelToModelFromDOM();
            loadDataToForm(jsonData);
            showMessage('Evaluation supprimée et réindexée');
        }


        // Mise à jour des index Topics/Quizz/Feedbacks/Courses
        function updatetopicsIndexes() {
            const container = document.getElementById('topics-container');
            const topics = container.children;
            for (let i = 0; i < topics.length; i++) {
                const topic = topics[i];
                topic.id = `topic-${i}`;

                // topicID
                const hid = topic.querySelector('input[name^="topic["][name$="].topicID"]');
                if (hid) hid.value = i + 1;
                if (jsonData.process.topics[i]) jsonData.process.topics[i].topicID = i + 1;

                // Renomme les champs
                topic.querySelectorAll('input[name], textarea[name], select[name]').forEach(elem => {
                    const name = elem.getAttribute('name');
                    if (!name) return;
                    let newName = name
                        .replace(/topic\[\d+\]/g, `topic[${i}]`)
                        .replace(/quizz\[\d+\]\[(\d+)\]/g, `quizz[${i}][$1]`)
                        .replace(/feedback\[\d+\]\[(\d+)\]\[(\d+)\]/g, `feedback[${i}][$1][$2]`);
                    elem.setAttribute('name', newName);
                });

                // Header handlers
                const header = topic.querySelector('.array-item-header');
                if (header) {
                    const collapseBtn = header.querySelector('.btn.btn-collapse');
                    if (collapseBtn) collapseBtn.setAttribute('onclick', `toggleCollapse('topic-${i}')`);
                    const duplicateBtn = header.querySelector('.btn.btn-add');
                    if (duplicateBtn) duplicateBtn.setAttribute('onclick', `duplicateTopic(${i})`);
                    const removeBtn = header.querySelector('.btn.btn-remove');
                    if (removeBtn) removeBtn.setAttribute('onclick', `removetopic(${i})`);
                }

                // Titre
                const title = topic.querySelector(`[id^="topic-title-display-"]`);
                const inputTitle = topic.querySelector(`input[name^="topic["][name$="].topicTitle"]`);
                if (title) {
                    title.id = `topic-title-display-${i}`;
                    const val = inputTitle ? inputTitle.value : '';
                    title.innerHTML = `<b>Topic ${i + 1}${val ? ' | </b>' + escapeHtml(val) : ''}`;
                }
                if (inputTitle && title) {
                    inputTitle.oninput = function (e) {
                        title.innerHTML = `<b>Topic ${i + 1}${e.target.value ? ' | </b>' + escapeHtml(e.target.value) : ''}`;
                        if (jsonData.process.topics[i]) jsonData.process.topics[i].topicTitle = e.target.value;
                        refreshAllcoursePathBuilders();
                    };
                }

                // Quizzes container id + reindex quizzes
                const quizzesContainer = topic.querySelector(`[id^="quizzes-container-"]`);
                if (quizzesContainer) {
                    quizzesContainer.id = `quizzes-container-${i}`;
                    updateQuizzesIndexes(i);
                }

                // Met à jour les IDs des inputs de fichiers et leurs boutons
                const topicImgFile = topic.querySelector(`input[type="file"][id^="topicImg-"]`);
                if (topicImgFile) {
                    topicImgFile.id = `topicImg-${i}`;
                    const topicImgBtn = topic.querySelector(`button[onclick*="topicImg-"]`);
                    if (topicImgBtn) {
                        topicImgBtn.setAttribute('onclick', `document.getElementById('topicImg-${i}').click()`);
                    }
                }

                const topicHologramFile = topic.querySelector(`input[type="file"][id^="topicHologram-"]`);
                if (topicHologramFile) {
                    topicHologramFile.id = `topicHologram-${i}`;
                    const topicHologramBtn = topic.querySelector(`button[onclick*="topicHologram-"]`);
                    if (topicHologramBtn) {
                        topicHologramBtn.setAttribute('onclick', `document.getElementById('topicHologram-${i}').click()`);
                    }
                }

                const topicAudioFile = topic.querySelector(`input[type="file"][id^="topicAudio-"]`);
                if (topicAudioFile) {
                    topicAudioFile.id = `topicAudio-${i}`;
                    const topicAudioBtn = topic.querySelector(`button[onclick*="topicAudio-"]`);
                    if (topicAudioBtn) {
                        topicAudioBtn.setAttribute('onclick', `document.getElementById('topicAudio-${i}').click()`);
                    }
                }

                const topicEnv360File = topic.querySelector(`input[type="file"][id^="topicEnv360-"]`);
                if (topicEnv360File) {
                    topicEnv360File.id = `topicEnv360-${i}`;
                    const topicEnv360Btn = topic.querySelector(`button[onclick*="topicEnv360-"]`);
                    if (topicEnv360Btn) {
                        topicEnv360Btn.setAttribute('onclick', `document.getElementById('topicEnv360-${i}').click()`);
                    }
                }

                // Met à jour le bouton "Ajouter un quizz"
                const addQuizzBtn = topic.querySelector('button[onclick^="addquizz("]');
                if (addQuizzBtn) {
                    addQuizzBtn.setAttribute('onclick', `addquizz(${i})`);
                }

                // Réactiver le drag & drop pour ce topic après réindexation
                // setupTopicDragAndDrop(topic); // Drag & drop désactivé pour les topics
            }
            refreshAllcoursePathBuilders();
        }

        function updateQuizzesIndexes(topicIndex) {
            const quizzesContainer = document.getElementById(`quizzes-container-${topicIndex}`);
            if (!quizzesContainer) return;
            const quizzes = quizzesContainer.children;
            for (let j = 0; j < quizzes.length; j++) {
                const quizz = quizzes[j];
                quizz.id = `quizz-${topicIndex}-${j}`;

                quizz.querySelectorAll('input[name], textarea[name], select[name]').forEach(elem => {
                    const name = elem.getAttribute('name');
                    if (!name) return;
                    let newName = name
                        .replace(/quizz\[\d+\]\[\d+\]/g, `quizz[${topicIndex}][${j}]`)
                        .replace(/quizIndicators\[\d+\]\[\d+\]\[(\d+)\]/g, `quizIndicators[${topicIndex}][${j}][$1]`)
                        .replace(/feedback\[\d+\]\[\d+\]\[(\d+)\]/g, `feedback[${topicIndex}][${j}][$1]`);
                    elem.setAttribute('name', newName);
                });

                // Header handlers
                const header = quizz.querySelector('.array-item-header');
                if (header) {
                    const collapseBtn = header.querySelector('.btn.btn-collapse');
                    if (collapseBtn) collapseBtn.setAttribute('onclick', `toggleCollapse('quizz-${topicIndex}-${j}')`);
                    const removeBtn = header.querySelector('.btn.btn-remove');
                    if (removeBtn) removeBtn.setAttribute('onclick', `removequizz(${topicIndex}, ${j})`);
                    const moveUpBtn = header.querySelector('.quizz-move-up-btn');
                    if (moveUpBtn) moveUpBtn.setAttribute('onclick', `moveQuizzInTopic(${topicIndex}, ${j}, -1)`);
                    const moveDownBtn = header.querySelector('.quizz-move-down-btn');
                    if (moveDownBtn) moveDownBtn.setAttribute('onclick', `moveQuizzInTopic(${topicIndex}, ${j}, 1)`);
                }

                // Update custom ordered select ID and onclick attributes
                const customSelect = quizz.querySelector(`[id^="custom-ordered-select-"]`);
                if (customSelect) {
                    customSelect.id = `custom-ordered-select-${topicIndex}-${j}`;
                    const trigger = customSelect.querySelector('.custom-select-trigger');
                    if (trigger) {
                        trigger.setAttribute('onclick', `toggleCustomOrderedDropdown(event, ${topicIndex}, ${j})`);
                    }
                    const options = customSelect.querySelectorAll('.custom-option');
                    options.forEach(opt => {
                        const val = opt.dataset.value;
                        const txt = val === 'true' ? "Dans l'ordre" : "Aléatoire";
                        opt.setAttribute('onclick', `selectCustomOrderedOption(event, ${topicIndex}, ${j}, '${val}', '${txt}')`);
                    });
                }

                // Bouton d'ajout de choix
                const addChoiceBtn = quizz.querySelector('button[onclick*="addFeedback"]');
                if (addChoiceBtn) {
                    addChoiceBtn.setAttribute('onclick', `addFeedback(${topicIndex}, ${j})`);
                }

                // Bouton d'ajout d'indicateur
                const addIndicatorBtn = quizz.querySelector('button[onclick*="addQuizzIndicator"]');
                if (addIndicatorBtn) {
                    addIndicatorBtn.setAttribute('onclick', `addQuizzIndicator(${topicIndex}, ${j})`);
                }

                const indicatorsContainer = quizz.querySelector(`[id^="quizz-indicators-container-"]`);
                if (indicatorsContainer) {
                    indicatorsContainer.id = `quizz-indicators-container-${topicIndex}-${j}`;
                    updateQuizzIndicatorsIndexes(topicIndex, j);
                }

                // Title display + rebind input listener with nouvel index
                const title = quizz.querySelector(`[id^="quizz-title-display-"]`);
                const inputQ = quizz.querySelector(`textarea[name^="quizz["][name$="].quizQuestion"]`);
                if (title) {
                    title.id = `quizz-title-display-${topicIndex}-${j}`;
                    const val = inputQ ? inputQ.value : '';
                    title.innerHTML = `<b>Question ${j + 1}${val ? ' | </b>' + escapeHtml(val) : ''}`;
                }
                if (inputQ && title) {
                    inputQ.oninput = function (e) {
                        title.innerHTML = `<b>Question ${j + 1}${e.target.value ? ' | </b>' + escapeHtml(e.target.value) : ''}`;
                        if (jsonData.process.topics[topicIndex] && jsonData.process.topics[topicIndex].quizzes[j]) {
                            jsonData.process.topics[topicIndex].quizzes[j].quizQuestion = e.target.value;
                        }
                    };
                }

                const quizzPosRotToggle = quizz.querySelector(`[id^="quizz-posrot-toggle-"]`);
                if (quizzPosRotToggle) {
                    quizzPosRotToggle.id = `quizz-posrot-toggle-${topicIndex}-${j}`;
                    quizzPosRotToggle.setAttribute('onclick', `toggleQuizzPosRot(${topicIndex}, ${j})`);
                }

                const quizzPosRotContent = quizz.querySelector(`[id^="quizz-posrot-content-"]`);
                if (quizzPosRotContent) {
                    quizzPosRotContent.id = `quizz-posrot-content-${topicIndex}-${j}`;
                }

                // Feedbacks container
                const fbc = quizz.querySelector(`[id^="feedbacks-container-"]`);
                if (fbc) {
                    fbc.id = `feedbacks-container-${topicIndex}-${j}`;
                    updateFeedbacksIndexes(topicIndex, j);
                }
                
                // Réactiver le drag & drop pour ce quizz après réindexation
                setupQuizzDragAndDrop(quizz, topicIndex);
            }
            
            // Reconfigurer le drop sur le conteneur après réindexation
            setupQuizzesContainerDrop(topicIndex);
        }

        function updateFeedbacksIndexes(topicIndex, quizzIndex) {
            const fbc = document.getElementById(`feedbacks-container-${topicIndex}-${quizzIndex}`);
            if (!fbc) return;
            const items = fbc.children;
            for (let k = 0; k < items.length; k++) {
                const fb = items[k];
                fb.id = `feedback-${topicIndex}-${quizzIndex}-${k}`;

                fb.querySelectorAll('input[name], textarea[name], select[name]').forEach(elem => {
                    const name = elem.getAttribute('name');
                    if (!name) return;
                    let newName = name
                        .replace(/feedback\[\d+\]\[\d+\]\[\d+\]/g, `feedback[${topicIndex}][${quizzIndex}][${k}]`);
                    elem.setAttribute('name', newName);
                });

                // Ne pas modifier choiceID - c'est un identifiant unique permanent
                // Le choiceID reste le même même après réorganisation

                // Header handlers
                const header = fb.querySelector('.array-item-header');
                if (header) {
                    const collapseBtn = header.querySelector('.btn.btn-collapse');
                    if (collapseBtn) collapseBtn.setAttribute('onclick', `toggleCollapse('feedback-${topicIndex}-${quizzIndex}-${k}')`);
                    const removeBtn = header.querySelector('.btn.btn-remove');
                    if (removeBtn) removeBtn.setAttribute('onclick', `removeFeedback(${topicIndex}, ${quizzIndex}, ${k})`);
                    const moveUpBtn = header.querySelector('.feedback-move-up-btn');
                    if (moveUpBtn) moveUpBtn.setAttribute('onclick', `moveFeedbackInQuizz(${topicIndex}, ${quizzIndex}, ${k}, -1)`);
                    const moveDownBtn = header.querySelector('.feedback-move-down-btn');
                    if (moveDownBtn) moveDownBtn.setAttribute('onclick', `moveFeedbackInQuizz(${topicIndex}, ${quizzIndex}, ${k}, 1)`);
                }

                // Title display + rebind input listener avec le nouvel index
                const title = fb.querySelector(`[id^="feedback-title-display-"]`);
                const choiceInput = fb.querySelector(`input[name^="feedback["][name$="].choice"]`);
                if (title) {
                    title.id = `feedback-title-display-${topicIndex}-${quizzIndex}-${k}`;
                }
                if (choiceInput && title) {
                    choiceInput.oninput = function (e) {
                        if (jsonData.process.topics[topicIndex] && jsonData.process.topics[topicIndex].quizzes[quizzIndex] && jsonData.process.topics[topicIndex].quizzes[quizzIndex].quizChoices[k]) {
                            jsonData.process.topics[topicIndex].quizzes[quizzIndex].quizChoices[k].choice = e.target.value;
                        }
                        updateFeedbackDisplayTitle(topicIndex, quizzIndex, k);
                    };
                }

                // Met à jour les boutons de type d'indicateur (exclure le bouton PosRot qui n'a pas de data-type)
                fb.querySelectorAll('.feedback-type-btn[data-type]').forEach(btn => {
                    const type = btn.dataset.type;
                    btn.setAttribute('onclick', `updateFeedbackType(${topicIndex}, ${quizzIndex}, ${k}, '${type}')`);
                });

                // Met à jour le bouton clear indicateur
                const clearBtn = fb.querySelector(`[id^="clear-feedback-indicator-"]`);
                if (clearBtn) {
                    clearBtn.id = `clear-feedback-indicator-${topicIndex}-${quizzIndex}-${k}`;
                    clearBtn.setAttribute('onclick', `clearFeedbackType(${topicIndex}, ${quizzIndex}, ${k})`);
                }

                // Met à jour l'input hidden feedbackPrefab
                const hiddenPrefab = fb.querySelector(`[id^="feedbackPrefab-"]`);
                if (hiddenPrefab) {
                    hiddenPrefab.id = `feedbackPrefab-${topicIndex}-${quizzIndex}-${k}`;
                }

                // Met à jour la div des options
                const optionsDiv = fb.querySelector(`[id^="feedback-options-"]`);
                if (optionsDiv) {
                    optionsDiv.id = `feedback-options-${topicIndex}-${quizzIndex}-${k}`;
                }

                // Met à jour le bouton distance
                const distanceBtn = fb.querySelector(`[id^="distance-btn-"]`);
                if (distanceBtn) {
                    distanceBtn.id = `distance-btn-${topicIndex}-${quizzIndex}-${k}`;
                    distanceBtn.setAttribute('onclick', `toggleFeedbackDistance(${topicIndex}, ${quizzIndex}, ${k})`);
                }

                // Met à jour les boutons direction
                fb.querySelectorAll('.feedback-option-btn-small[data-option="in"], .feedback-option-btn-small[data-option="out"]').forEach(btn => {
                    const direction = btn.dataset.option;
                    btn.setAttribute('onclick', `updateFeedbackDirection(${topicIndex}, ${quizzIndex}, ${k}, '${direction}')`);
                });

                // Met à jour les boutons orientation
                fb.querySelectorAll('.feedback-option-btn-small[data-option="vertical"], .feedback-option-btn-small[data-option="horizontal"]').forEach(btn => {
                    const orientation = btn.dataset.option;
                    btn.setAttribute('onclick', `updateFeedbackOrientation(${topicIndex}, ${quizzIndex}, ${k}, '${orientation}')`);
                });

                const posRotToggle = fb.querySelector(`[id^="feedback-posrot-toggle-"]`);
                if (posRotToggle) {
                    posRotToggle.id = `feedback-posrot-toggle-${topicIndex}-${quizzIndex}-${k}`;
                    posRotToggle.setAttribute('onclick', `toggleFeedbackPosRot(${topicIndex}, ${quizzIndex}, ${k})`);
                }

                const posRotContent = fb.querySelector(`[id^="feedback-posrot-content-"]`);
                if (posRotContent) {
                    posRotContent.id = `feedback-posrot-content-${topicIndex}-${quizzIndex}-${k}`;
                }

                // Met à jour le titre affiché avec le type d'indicateur
                updateFeedbackDisplayTitle(topicIndex, quizzIndex, k);

                // Réactiver le drag & drop sur ce choix
                setupChoiceDragAndDrop(fb, topicIndex, quizzIndex);
            }

            // S'assure que le conteneur a bien ses handlers
            setupChoicesContainerDrop(topicIndex, quizzIndex);
        }

        function updatecoursesIndexes() {
            const container = document.getElementById('courses-container');
            const courses = container.children;
            for (let i = 0; i < courses.length; i++) {
                const course = courses[i];
                course.id = `course-${i}`;

                // courseID
                const hid = course.querySelector('input[name^="course["][name$="].courseID"]');
                if (hid) hid.value = i + 1;
                if (jsonData.process.courses[i]) jsonData.process.courses[i].courseID = String(i + 1);

                // Renomme champs
                course.querySelectorAll('input[name], textarea[name], select[name]').forEach(elem => {
                    const name = elem.getAttribute('name');
                    if (!name) return;
                    const newName = name.replace(/course\[\d+\]/g, `course[${i}]`);
                    elem.setAttribute('name', newName);
                });

                // IDs path builder
                const hiddenPath = course.querySelector(`[id^="coursePath-input-"]`);
                if (hiddenPath) hiddenPath.id = `coursePath-input-${i}`;
                const avail = course.querySelector(`[id^="courseAvailabletopics-"]`);
                if (avail) avail.id = `courseAvailabletopics-${i}`;
                const selected = course.querySelector(`[id^="courseSelectedtopics-"]`);
                if (selected) selected.id = `courseSelectedtopics-${i}`;

                // Header handlers
                const header = course.querySelector('.array-item-header');
                if (header) {
                    const collapseBtn = header.querySelector('.btn.btn-collapse');
                    if (collapseBtn) collapseBtn.setAttribute('onclick', `toggleCollapse('course-${i}')`);
                    const removeBtn = header.querySelector('.btn.btn-remove');
                    if (removeBtn) removeBtn.setAttribute('onclick', `removecourse(${i})`);
                }

                // Titre
                const title = course.querySelector(`[id^="course-title-display-"]`);
                const inputTitle = course.querySelector(`input[name^="course["][name$="].courseTitle"]`);
                if (title) {
                    title.id = `course-title-display-${i}`;
                    const val = inputTitle ? inputTitle.value : '';
                    title.innerHTML = `<b>Evaluation ${i + 1}${val ? ' | </b>' + val : ''}`;  
                }
                if (inputTitle && title) {
                    inputTitle.oninput = function (e) {
                        title.innerHTML = `<b>Evaluation ${i + 1}${e.target.value ? ' | </b>' + e.target.value : ''}`;  
                        if (jsonData.process.courses[i]) jsonData.process.courses[i].courseTitle = e.target.value;
                    };
                }
            }
            refreshAllcoursePathBuilders();
        }

        function collectFormData() {
            const formData = new FormData(document.getElementById('jsonForm'));
            
            // Read stored variant data if available to merge
            let variantData = {};
            try {
                const stored = sessionStorage.getItem('iximaker_variant_data');
                if (stored) {
                    variantData = JSON.parse(stored);
                }
            } catch (e) {
                console.error(e);
            }

            const data = {
                usage: variantData.usage || document.getElementById('usage').value,
                settings: {
                    contentVersion: document.getElementById('contentVersion').value || (variantData.settings?.contentVersion || 1),
                    creatorID: parseInt(document.getElementById('creatorID').value) || (variantData.settings?.creatorID || 0),
                    ownerName: document.getElementById('ownerName').value || (variantData.settings?.ownerName || ""),
                    ownerIdentifier: document.getElementById('ownerIdentifier').value || (variantData.settings?.ownerIdentifier || ""),
                    appVersion: variantData.settings?.appVersion || "MiniMaker-1.0",
                    chapter: variantData.settings?.chapter || "",
                    calibrateAfterStageID: variantData.settings?.calibrateAfterStageID || 0,
                    unit: variantData.settings?.unit || "mm",
                    langCode: variantData.settings?.langCode || "FR"
                },
                process: {
                    processTitle: variantData.process?.processTitle || "",
                    processDesc: variantData.process?.processDesc || "",
                    workspaceShape: variantData.process?.workspaceShape || "square",
                    workspaceShapeSize: variantData.process?.workspaceShapeSize || { x: 0, y: 0, z: 0 },
                    workspaceShapeRot: variantData.process?.workspaceShapeRot || { x: 0, y: 0, z: 0 },
                    workspaceOffsetPos: variantData.process?.workspaceOffsetPos || { x: 0, y: 0, z: 0 },
                    workspaceOffsetRot: variantData.process?.workspaceOffsetRot || { x: 0, y: 0, z: 0 },
                    mainHologram: variantData.process?.mainHologram || "",
                    workspaceOffsetCalc: variantData.process?.workspaceOffsetCalc || 'auto-mid',
                    topics: [],
                    courses: []
                }
            };

            // Collecter les Topics
            const topicsContainer = document.getElementById('topics-container');
            for (let i = 0; i < topicsContainer.children.length; i++) {
                const linkedStageIDInput = document.querySelector(`input[name="topic[${i}].linkedStageID"]`);
                const topicEnv360RotInput = document.querySelector(`input[name="topic[${i}].topicEnv360Rot"]`);
                
                const topic = {
                    topicID: parseInt(document.querySelector(`input[name="topic[${i}].topicID"]`).value) || 0,
                    topicTitle: document.querySelector(`input[name="topic[${i}].topicTitle"]`).value,
                    topicDesc: document.querySelector(`textarea[name="topic[${i}].topicDesc"]`).value,
                    topicImg: document.querySelector(`input[name="topic[${i}].topicImg"]`).value,
                    topicHologram: document.querySelector(`input[name="topic[${i}].topicHologram"]`).value,
                    linkedStageID: linkedStageIDInput ? (parseInt(linkedStageIDInput.value) || 0) : 0,
                    topicEnv360: document.querySelector(`input[name="topic[${i}].topicEnv360"]`).value,
                    topicEnv360Rot: topicEnv360RotInput ? topicEnv360RotInput.value : "",
                    topicHologramOffsetPos: {
                        x: parseInt(document.querySelector(`input[name="topic[${i}].topicHologramOffsetPos.x"]`).value) || 0,
                        y: parseInt(document.querySelector(`input[name="topic[${i}].topicHologramOffsetPos.y"]`).value) || 0,
                        z: parseInt(document.querySelector(`input[name="topic[${i}].topicHologramOffsetPos.z"]`).value) || 0
                    },
                    topicHologramOffsetRot: {
                        x: parseInt(document.querySelector(`input[name="topic[${i}].topicHologramOffsetRot.x"]`).value) || 0,
                        y: parseInt(document.querySelector(`input[name="topic[${i}].topicHologramOffsetRot.y"]`).value) || 0,
                        z: parseInt(document.querySelector(`input[name="topic[${i}].topicHologramOffsetRot.z"]`).value) || 0
                    },
                    topicHologramInteractable: document.querySelector(`input[name="topic[${i}].topicHologramInteractable"]`).checked,
                    topicAudioText: document.querySelector(`textarea[name="topic[${i}].topicAudioText"]`).value,
                    topicAudio: document.querySelector(`input[name="topic[${i}].topicAudio"]`).value,
                    quizzes: []
                };

                // Collecter les quizzes de cette Topic
                const quizzesContainer = document.getElementById(`quizzes-container-${i}`);
                if (quizzesContainer) {
                    for (let j = 0; j < quizzesContainer.children.length; j++) {
                        const quizQuestionElem = document.querySelector(`textarea[name="quizz[${i}][${j}].quizQuestion"]`);
                        const quizNoteElem = document.querySelector(`textarea[name="quizz[${i}][${j}].quizNote"]`);
                        
                        // Ne traiter que les quizz valides avec au moins un titre
                        if (!quizQuestionElem) continue;
                        
                        const quizzIndicatorsContainer = document.getElementById(`quizz-indicators-container-${i}-${j}`);
                        const quizzIndicatorsValue = [];
                        if (quizzIndicatorsContainer) {
                            for (let k = 0; k < quizzIndicatorsContainer.children.length; k++) {
                                const indicatorCard = quizzIndicatorsContainer.children[k];
                                const prefabElem = indicatorCard.querySelector(`input[id^="quizzIndicatorPrefab-"]`);
                                let indicatorPrefabValue;
                                try {
                                    indicatorPrefabValue = prefabElem ? JSON.parse(prefabElem.value) : [];
                                } catch (e) {
                                    indicatorPrefabValue = [];
                                }

                                quizzIndicatorsValue.push({
                                    indicatorPrefab: indicatorPrefabValue,
                                    indicatorPrefabScale: document.querySelector(`input[name="quizIndicators[${i}][${j}][${k}].indicatorPrefabScale"]`)?.value || "1",
                                    indicatorPos: {
                                        x: parseInt(document.querySelector(`input[name="quizIndicators[${i}][${j}][${k}].indicatorPos.x"]`)?.value) || 0,
                                        y: parseInt(document.querySelector(`input[name="quizIndicators[${i}][${j}][${k}].indicatorPos.y"]`)?.value) || 0,
                                        z: parseInt(document.querySelector(`input[name="quizIndicators[${i}][${j}][${k}].indicatorPos.z"]`)?.value) || 0
                                    },
                                    indicatorRot: {
                                        x: parseInt(document.querySelector(`input[name="quizIndicators[${i}][${j}][${k}].indicatorRot.x"]`)?.value) || 0,
                                        y: parseInt(document.querySelector(`input[name="quizIndicators[${i}][${j}][${k}].indicatorRot.y"]`)?.value) || 0,
                                        z: parseInt(document.querySelector(`input[name="quizIndicators[${i}][${j}][${k}].indicatorRot.z"]`)?.value) || 0
                                    }
                                });
                            }
                        }
                        
                        const orderedElem = document.querySelector(`select[name="quizz[${i}][${j}].ordered"]`);
                        const quizz = {
                            quizQuestion: quizQuestionElem.value,
                            quizNote: quizNoteElem ? quizNoteElem.value : "",
                            quizChoices: [],
                            quizIndicators: quizzIndicatorsValue,
                            choiceID: j + 1,
                            ordered: orderedElem ? (orderedElem.value === "true") : true
                        };

                        // Collecter les feedbacks de cette quizz
                        const feedbacksContainer = document.getElementById(`feedbacks-container-${i}-${j}`);
                        if (feedbacksContainer) {
                            for (let k = 0; k < feedbacksContainer.children.length; k++) {
                                const choiceElem = document.querySelector(`input[name="feedback[${i}][${j}][${k}].choice"]`);
                                const answerElem = document.querySelector(`textarea[name="feedback[${i}][${j}][${k}].answer"]`);
                                const correctElem = document.querySelector(`select[name="feedback[${i}][${j}][${k}].correct"]`);
                                const orderedElem = document.querySelector(`select[name="ordered[${i}][${j}][${k}].ordered"]`);
                                const feedbackPrefabElem = document.getElementById(`feedbackPrefab-${i}-${j}-${k}`);
                                
                                if (!choiceElem) continue;
                                
                                // Parser le feedbackPrefab JSON array
                                let feedbackPrefabValue;
                                try {
                                    feedbackPrefabValue = feedbackPrefabElem ? JSON.parse(feedbackPrefabElem.value) : [];
                                } catch (e) {
                                    feedbackPrefabValue = [];
                                }
                                
                                const feedback = {
                                    choiceID: parseInt(document.querySelector(`input[name="feedback[${i}][${j}][${k}].choiceID"]`)?.value) || generateUniqueID(),
                                    choice: choiceElem.value,
                                    correct: correctElem ? (correctElem.value === "true") : false,
                                    answer: answerElem ? answerElem.value : "",
                                    choiceFeedbacks: {
                                        feedbackPrefab: feedbackPrefabValue,
                                        feedbackPos: {
                                            x: parseInt(document.querySelector(`input[name="feedback[${i}][${j}][${k}].feedbackPos.x"]`)?.value) || 0,
                                            y: parseInt(document.querySelector(`input[name="feedback[${i}][${j}][${k}].feedbackPos.y"]`)?.value) || 0,
                                            z: parseInt(document.querySelector(`input[name="feedback[${i}][${j}][${k}].feedbackPos.z"]`)?.value) || 0
                                        },
                                        feedbackRot: {
                                            x: parseInt(document.querySelector(`input[name="feedback[${i}][${j}][${k}].feedbackRot.x"]`)?.value) || 0,
                                            y: parseInt(document.querySelector(`input[name="feedback[${i}][${j}][${k}].feedbackRot.y"]`)?.value) || 0,
                                            z: parseInt(document.querySelector(`input[name="feedback[${i}][${j}][${k}].feedbackRot.z"]`)?.value) || 0
                                        },
                                        feedbackPrefabScale: document.querySelector(`input[name="feedback[${i}][${j}][${k}].feedbackPrefabScale"]`)?.value || "1"
                                    },
                                    numero: k + 1
                                };
                                quizz.quizChoices.push(feedback);
                            }
                        }

                        topic.quizzes.push(quizz);
                    }
                }

                data.process.topics.push(topic);
            }

            // Collecter les courses
            const coursesContainer = document.getElementById('courses-container');
            for (let i = 0; i < coursesContainer.children.length; i++) {
                const course = {
                    courseID: String(document.querySelector(`input[name="course[${i}].courseID"]`)?.value || (i + 1)),
                    courseTitle: document.querySelector(`input[name="course[${i}].courseTitle"]`)?.value || '',
                    courseDesc: document.querySelector(`textarea[name="course[${i}].courseDesc"]`)?.value || '',
                    courseRequiresCourseID: String(document.querySelector(`input[name="course[${i}].courseRequiresCourseID"]`)?.value || ''),
                    coursePath: document.getElementById(`coursePath-input-${i}`)?.value || '',
                    courseImg: '',
                    courseEnv360: '',
                    courseEnv360Rot: '',
                    coursePos: {
                        x: 0,
                        y: 0,
                        z: 0
                    },
                    courseRot: {
                        x: 0,
                        y: 0,
                        z: 0
                    },
                    courseAudioText: '',
                    courseAudio: ''
                };
                data.process.courses.push(course);
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
            //a.download = 'learn.json';
            a.download = `${data.settings.chapter}_${data.process.processTitle}_learn.json`;

            a.click();
            URL.revokeObjectURL(url);
            showMessage('JSON exporté avec succès !');
        }

        // Charger les données dans le formulaire
        function loadDataToForm(data, isImporting = true) {
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
            document.getElementById('creatorID').value = data.settings?.creatorID || 0;

            const importedOwnerName = data.settings?.ownerName || '';
            const importedOwnerId = data.settings?.ownerIdentifier || '';

            if (isImporting) {
                if (importedOwnerName) {
                    document.getElementById('ownerName').value = importedOwnerName;
                    sessionStorage.setItem('iximaker_learn_owner', importedOwnerName);
                }
                if (importedOwnerId) {
                    document.getElementById('ownerIdentifier').value = importedOwnerId;
                }
            } else {
                const localOwner = sessionStorage.getItem('iximaker_learn_owner');
                if (localOwner) {
                    document.getElementById('ownerName').value = localOwner;
                } else {
                    document.getElementById('ownerName').value = '';
                }
                if (importedOwnerId) {
                    document.getElementById('ownerIdentifier').value = importedOwnerId;
                }
            }

            // Réinitialiser les conteneurs
            document.getElementById('topics-container').innerHTML = '';
            document.getElementById('courses-container').innerHTML = '';

            // Snapshot pour éviter d'effacer data si data === jsonData
            const topicsData = Array.isArray(data.process?.topics) ? data.process.topics.slice() : [];
            const coursesData = Array.isArray(data.process?.courses) ? data.process.courses.slice() : [];

            // Charger les Topics
            if (topicsData.length) {
                jsonData.process.topics = [];
                topicsData.forEach((topic, index) => {
                    addTopic();
                    const lastIndex = jsonData.process.topics.length - 1;

                    document.querySelector(`input[name="topic[${lastIndex}].topicTitle"]`).value = topic.topicTitle || '';
                    document.querySelector(`input[name="topic[${lastIndex}].topicID"]`).value = topic.topicID || 0;
                    document.querySelector(`textarea[name="topic[${lastIndex}].topicDesc"]`).value = topic.topicDesc || '';
                    document.querySelector(`input[name="topic[${lastIndex}].topicImg"]`).value = topic.topicImg || '';
                    document.querySelector(`input[name="topic[${lastIndex}].topicHologram"]`).value = topic.topicHologram || '';
                    // Chargement des offsets d'hologramme
                    document.querySelector(`input[name="topic[${lastIndex}].topicHologramOffsetPos.x"]`).value = topic.topicHologramOffsetPos?.x || 0;
                    document.querySelector(`input[name="topic[${lastIndex}].topicHologramOffsetPos.y"]`).value = topic.topicHologramOffsetPos?.y || 0;
                    document.querySelector(`input[name="topic[${lastIndex}].topicHologramOffsetPos.z"]`).value = topic.topicHologramOffsetPos?.z || 0;

                    document.querySelector(`input[name="topic[${lastIndex}].topicHologramOffsetRot.x"]`).value = topic.topicHologramOffsetRot?.x || 0;
                    document.querySelector(`input[name="topic[${lastIndex}].topicHologramOffsetRot.y"]`).value = topic.topicHologramOffsetRot?.y || 0;
                    document.querySelector(`input[name="topic[${lastIndex}].topicHologramOffsetRot.z"]`).value = topic.topicHologramOffsetRot?.z || 0;

                    // Chargement des autres propriétés
                    const topicHologramInteractableInput = document.querySelector(`input[name="topic[${lastIndex}].topicHologramInteractable"]`);
                    if (topicHologramInteractableInput) topicHologramInteractableInput.checked = topic.topicHologramInteractable || false;
                    
                    const topicAudioTextInput = document.querySelector(`textarea[name="topic[${lastIndex}].topicAudioText"]`);
                    if (topicAudioTextInput) topicAudioTextInput.value = topic.topicAudioText || '';
                    
                    const topicAudioInput = document.querySelector(`input[name="topic[${lastIndex}].topicAudio"]`);
                    if (topicAudioInput) topicAudioInput.value = topic.topicAudio || '';
                    
                    const topicEnv360Input = document.querySelector(`input[name="topic[${lastIndex}].topicEnv360"]`);
                    if (topicEnv360Input) topicEnv360Input.value = topic.topicEnv360 || '';
                    
                    const linkedStageIDInput = document.querySelector(`input[name="topic[${lastIndex}].linkedStageID"]`);
                    if (linkedStageIDInput) linkedStageIDInput.value = topic.linkedStageID !== undefined ? topic.linkedStageID : 0;
                    
                    const topicEnv360RotInput = document.querySelector(`input[name="topic[${lastIndex}].topicEnv360Rot"]`);
                    if (topicEnv360RotInput) topicEnv360RotInput.value = topic.topicEnv360Rot || '';

                    // Synchronise le span du titre du Topic
                    var titre = topic.topicTitle || '';
                    var display = document.getElementById(`topic-title-display-${lastIndex}`);
                    if (display) {
                        display.textContent = `ID${lastIndex + 1}${titre ? ' | ' + titre : ' | [sans nom]'}`;
                    }
                    
                    // Charger les quizzes
                    if (topic.quizzes) {
                        topic.quizzes.forEach((quizz, quizzIndex) => {
                            addquizz(lastIndex);
                            const lastquizzIndex = jsonData.process.topics[lastIndex].quizzes.length - 1;

                            // Gérer à la fois les anciens noms (quizQuestion, quizNote) et les nouveaux (quizQuestion, quizNote)
                            const quizQuestion = quizz.quizQuestion || quizz.quizQuestion || '';
                            const quizNote = quizz.quizNote || quizz.quizNote || '';

                            const quizQuestionInput = document.querySelector(`textarea[name="quizz[${lastIndex}][${lastquizzIndex}].quizQuestion"]`);
                            if (quizQuestionInput) quizQuestionInput.value = quizQuestion;
                            
                            const quizNoteInput = document.querySelector(`textarea[name="quizz[${lastIndex}][${lastquizzIndex}].quizNote"]`);
                            if (quizNoteInput) quizNoteInput.value = quizNote;

                            const orderedVal = quizz.ordered !== undefined ? quizz.ordered : true;
                            const orderedSelect = document.querySelector(`select[name="quizz[${lastIndex}][${lastquizzIndex}].ordered"]`);
                            if (orderedSelect) {
                                orderedSelect.value = orderedVal ? "true" : "false";
                            }
                            const customSelect = document.getElementById(`custom-ordered-select-${lastIndex}-${lastquizzIndex}`);
                            if (customSelect) {
                                const textSpan = customSelect.querySelector('.custom-select-text');
                                if (textSpan) textSpan.textContent = orderedVal ? "Dans l'ordre" : "Aléatoire";
                                customSelect.querySelectorAll('.custom-option').forEach(opt => {
                                    opt.classList.toggle('active', opt.dataset.value === (orderedVal ? "true" : "false"));
                                });
                            }

                            const quizIndicatorsData = Array.isArray(quizz.quizIndicators) && quizz.quizIndicators.length > 0
                                ? quizz.quizIndicators
                                : (Array.isArray(quizz.quizzIndicatorPrefab)
                                    ? [{
                                        indicatorPrefab: quizz.quizzIndicatorPrefab,
                                        indicatorPrefabScale: quizz.quizzIndicatorPrefabScale || '1',
                                        indicatorPos: quizz.quizzIndicatorPos || { x: 0, y: 0, z: 0 },
                                        indicatorRot: quizz.quizzIndicatorRot || { x: 0, y: 0, z: 0 }
                                    }]
                                    : []);

                            const indicatorsContainer = document.getElementById(`quizz-indicators-container-${lastIndex}-${lastquizzIndex}`);
                            if (indicatorsContainer) {
                                if (indicatorsContainer.children.length > 0 && quizIndicatorsData.length > 0) {
                                    applyQuizzIndicatorState(lastIndex, lastquizzIndex, 0, quizIndicatorsData[0] || {
                                        indicatorPrefab: [],
                                        indicatorPrefabScale: '1',
                                        indicatorPos: { x: 0, y: 0, z: 0 },
                                        indicatorRot: { x: 0, y: 0, z: 0 }
                                    });
                                }

                                for (let indicatorIndex = 1; indicatorIndex < quizIndicatorsData.length; indicatorIndex++) {
                                    addQuizzIndicator(lastIndex, lastquizzIndex, quizIndicatorsData[indicatorIndex]);
                                }
                            }

                            // Synchronise le titre du quizz dans le header
                            var quizzDisplay = document.getElementById(`quizz-title-display-${lastIndex}-${lastquizzIndex}`);
                            if (quizzDisplay) {
                                quizzDisplay.textContent = `Quizz ${lastquizzIndex + 1}${quizQuestion ? ' | ' + quizQuestion : ''}`;
                            }

                            // Charger les feedbacks - gérer à la fois les anciens (quizChoices) et nouveaux (quizChoices)
                            const feedbacks = quizz.quizChoices || quizz.quizChoices || [];
                            feedbacks.forEach((feedback, feedbackIndex) => {
                                addFeedback(lastIndex, lastquizzIndex);
                                const lastFeedbackIndex = jsonData.process.topics[lastIndex].quizzes[lastquizzIndex].quizChoices.length - 1;
                                const idInput = document.querySelector(`input[name="feedback[${lastIndex}][${lastquizzIndex}][${lastFeedbackIndex}].choiceID"]`);
                                if (idInput) idInput.value = feedback.choiceID || (lastFeedbackIndex + 1);


                                // Extraire les données du feedback
                                const choiceInput = document.querySelector(`input[name="feedback[${lastIndex}][${lastquizzIndex}][${lastFeedbackIndex}].choice"]`);
                                if (choiceInput) choiceInput.value = feedback.choice || '';
                                
                                const answerInput = document.querySelector(`textarea[name="feedback[${lastIndex}][${lastquizzIndex}][${lastFeedbackIndex}].answer"]`);
                                if (answerInput) answerInput.value = feedback.answer || '';
                                
                                const correctSelect = document.querySelector(`select[name="feedback[${lastIndex}][${lastquizzIndex}][${lastFeedbackIndex}].correct"]`);
                                if (correctSelect) correctSelect.value = feedback.correct ? "true" : "false";

                                // ordered parameter is now managed at quizz level

                                // Gérer l'ancien et le nouveau format de feedbackPrefab
                                let feedbackPrefabArray;
                                let feedbackPrefabScale = "1";
                                let feedbackPos = { x: 0, y: 0, z: 0 };
                                let feedbackRot = { x: 0, y: 0, z: 0 };
                                
                                // Nouveau format: choiceFeedbacks est un objet
                                if (feedback.choiceFeedbacks && typeof feedback.choiceFeedbacks === 'object' && !Array.isArray(feedback.choiceFeedbacks)) {
                                    feedbackPrefabArray = feedback.choiceFeedbacks.feedbackPrefab || [];
                                    feedbackPrefabScale = feedback.choiceFeedbacks.feedbackPrefabScale || "1";
                                    feedbackPos = feedback.choiceFeedbacks.feedbackPos || { x: 0, y: 0, z: 0 };
                                    feedbackRot = feedback.choiceFeedbacks.feedbackRot || { x: 0, y: 0, z: 0 };
                                }
                                // Format direct: feedbackPrefab directement sur le feedback
                                else if (Array.isArray(feedback.feedbackPrefab)) {
                                    feedbackPrefabArray = feedback.feedbackPrefab;
                                    feedbackPrefabScale = feedback.feedbackPrefabScale || "1";
                                    feedbackPos = feedback.feedbackPos || { x: 0, y: 0, z: 0 };
                                    feedbackRot = feedback.feedbackRot || { x: 0, y: 0, z: 0 };
                                }
                                // Ancien format array: choiceFeedbacks[0]
                                else if (feedback.choiceFeedbacks && Array.isArray(feedback.choiceFeedbacks) && feedback.choiceFeedbacks[0]) {
                                    const oldPrefab = feedback.choiceFeedbacks[0].feedbackPrefab;
                                    // Convertir l'ancien format string en nouveau format array
                                    // Exemple: "Point_out_hor" -> ["point", "out", "horizontal"]
                                    if (typeof oldPrefab === 'string') {
                                        const parts = oldPrefab.toLowerCase().split('_');
                                        feedbackPrefabArray = parts.map(p => {
                                            if (p === 'hor') return 'horizontal';
                                            if (p === 'ver') return 'vertical';
                                            return p;
                                        });
                                    } else {
                                        feedbackPrefabArray = oldPrefab || [];
                                    }
                                    feedbackPrefabScale = feedback.choiceFeedbacks[0].feedbackPrefabScale || "1";
                                    feedbackPos = feedback.choiceFeedbacks[0].feedbackPos || { x: 0, y: 0, z: 0 };
                                    feedbackRot = feedback.choiceFeedbacks[0].feedbackRot || { x: 0, y: 0, z: 0 };
                                }
                                else {
                                    feedbackPrefabArray = [];
                                }

                                // Mettre à jour l'input hidden avec le JSON array
                                const hiddenInput = document.getElementById(`feedbackPrefab-${lastIndex}-${lastquizzIndex}-${lastFeedbackIndex}`);
                                if (hiddenInput) {
                                    hiddenInput.value = JSON.stringify(feedbackPrefabArray);
                                }

                                // Mettre à jour les boutons UI selon le feedbackPrefab
                                const feedbackDiv = document.getElementById(`feedback-${lastIndex}-${lastquizzIndex}-${lastFeedbackIndex}`);
                                if (feedbackDiv && feedbackPrefabArray.length > 0) {
                                    const type = feedbackPrefabArray[0];
                                    
                                    // Activer le bon bouton de type
                                    const typeButtons = feedbackDiv.querySelectorAll('.feedback-type-btn');
                                    typeButtons.forEach(btn => {
                                        btn.classList.toggle('active', btn.dataset.type === type);
                                    });

                                    // Pour le type "point", charger direction/orientation/distance
                                    if (type === 'point' && feedbackPrefabArray.length >= 3) {
                                        const direction = feedbackPrefabArray[1] || 'out';
                                        const orientation = feedbackPrefabArray[2] || 'horizontal';
                                        const hasDistance = feedbackPrefabArray.includes('distance');

                                        // Mettre à jour les boutons direction
                                        const directionButtons = feedbackDiv.querySelectorAll('[data-option="in"], [data-option="out"]');
                                        directionButtons.forEach(btn => {
                                            btn.classList.toggle('active', btn.dataset.option === direction);
                                        });

                                        // Mettre à jour les boutons orientation
                                        const orientationButtons = feedbackDiv.querySelectorAll('[data-option="vertical"], [data-option="horizontal"]');
                                        orientationButtons.forEach(btn => {
                                            btn.classList.toggle('active', btn.dataset.option === orientation);
                                        });

                                        // Mettre à jour le bouton distance
                                        const distanceBtn = document.getElementById(`distance-btn-${lastIndex}-${lastquizzIndex}-${lastFeedbackIndex}`);
                                        if (distanceBtn) {
                                            distanceBtn.dataset.option = hasDistance ? 'oui' : 'non';
                                            distanceBtn.textContent = hasDistance ? 'Oui' : 'Non';
                                            distanceBtn.classList.toggle('active', hasDistance);
                                        }
                                    }

                                    // Afficher/masquer les options selon le type
                                    const optionsDiv = document.getElementById(`feedback-options-${lastIndex}-${lastquizzIndex}-${lastFeedbackIndex}`);
                                    if (optionsDiv) {
                                        optionsDiv.style.display = type === 'point' ? 'flex' : 'none';
                                    }

                                    // Afficher le bouton Annuler si un type est sélectionné
                                    const clearBtn = document.getElementById(`clear-feedback-indicator-${lastIndex}-${lastquizzIndex}-${lastFeedbackIndex}`);
                                    if (clearBtn) {
                                        clearBtn.style.display = type ? 'inline-block' : 'none';
                                    }
                                }

                                // Charger la position du feedbackPrefab
                                document.querySelector(`input[name="feedback[${lastIndex}][${lastquizzIndex}][${lastFeedbackIndex}].feedbackPos.x"]`).value = feedbackPos.x || 0;
                                document.querySelector(`input[name="feedback[${lastIndex}][${lastquizzIndex}][${lastFeedbackIndex}].feedbackPos.y"]`).value = feedbackPos.y || 0;
                                document.querySelector(`input[name="feedback[${lastIndex}][${lastquizzIndex}][${lastFeedbackIndex}].feedbackPos.z"]`).value = feedbackPos.z || 0;
                                
                                // Charger la rotation du feedbackPrefab
                                document.querySelector(`input[name="feedback[${lastIndex}][${lastquizzIndex}][${lastFeedbackIndex}].feedbackRot.x"]`).value = feedbackRot.x || 0;
                                document.querySelector(`input[name="feedback[${lastIndex}][${lastquizzIndex}][${lastFeedbackIndex}].feedbackRot.y"]`).value = feedbackRot.y || 0;
                                document.querySelector(`input[name="feedback[${lastIndex}][${lastquizzIndex}][${lastFeedbackIndex}].feedbackRot.z"]`).value = feedbackRot.z || 0;

                                // Charger l'échelle du feedbackPrefab
                                const scaleInput = document.querySelector(`input[name="feedback[${lastIndex}][${lastquizzIndex}][${lastFeedbackIndex}].feedbackPrefabScale"]`);
                                if (scaleInput) scaleInput.value = feedbackPrefabScale;
                               
                                // Synchronise le titre du feedback avec le format array
                                updateFeedbackDisplayTitle(lastIndex, lastquizzIndex, lastFeedbackIndex);
                            });
                        });
                    }
                });
            }

            // Charger les courses
            if (coursesData.length) {
                jsonData.process.courses = [];
                coursesData.forEach((course, index) => {
                    addcourse();
                    const lastIndex = jsonData.process.courses.length - 1;

                    document.querySelector(`input[name="course[${lastIndex}].courseTitle"]`).value = course.courseTitle || '';
                    document.querySelector(`textarea[name="course[${lastIndex}].courseDesc"]`).value = course.courseDesc || '';
                    document.querySelector(`input[name="course[${lastIndex}].courseID"]`).value = course.courseID || '';
                    document.querySelector(`input[name="course[${lastIndex}].courseRequiresCourseID"]`).value = course.courseRequiresCourseID !== undefined ? course.courseRequiresCourseID : '0';
                    const hiddenInput = document.getElementById(`coursePath-input-${lastIndex}`);
                    if (hiddenInput) {
                        hiddenInput.value = course.coursePath || '';
                        // Reconstruit les listes dispo/sélection à partir de la valeur existante
                        initcoursePathBuilder(lastIndex);
                    }
                    // synchronise le span du titre de course
                    var courseDisplay = document.getElementById(`course-title-display-${lastIndex}`);
                    var courseInput = document.querySelector(`input[name="course[${lastIndex}].courseTitle"]`);
                    if (courseDisplay && courseInput) {
                        courseDisplay.textContent = `Evaluation ${lastIndex + 1}${courseInput.value ? ' | ' + courseInput.value : ''}`;  
                        // Ajoute l'écouteur pour la mise à jour dynamique
                        courseInput.addEventListener('input', function (e) {
                            courseDisplay.textContent = `Evaluation ${lastIndex + 1}${e.target.value ? ' | ' + e.target.value : ''}`;  
                            jsonData.process.courses[lastIndex].courseTitle = e.target.value;
                        });
                    }
                });
            }
           //mise à jour de tous les constructeurs de chemin de course
           jsonData.process.topics.forEach((topic, i) => {
            topic.topicTitle = document.querySelector(`input[name="topic[${i}].topicTitle"]`).value;
            }); 
           refreshAllcoursePathBuilders();
           
           // Configure le drag & drop pour le conteneur de topics
           // setupTopicsContainerDrop(); // Drag & drop désactivé pour les topics
           
           syncAllCustomSelects();
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
                document.getElementById('topics-container').innerHTML = '';
                document.getElementById('courses-container').innerHTML = '';
                jsonData = {
                    usage: "",
                    settings: {
                        contentVersion: 1,
                        creatorID: 0,
                        ownerName: "",
                        ownerIdentifier: "",
                        appVersion: "",
                        chapter: "",
                        unit: "mm",
                        langCode: ""
                    },
                    process: {
                        topics: [],
                        courses: []
                    }
                };
                // topicIdCounter = 1;
                courseIdCounter = 1;
                quizzIdCounter = 1;
                showMessage('Formulaire réinitialisé');
            }
        }

        // Helper functions for custom ordered select on mobile
        function toggleCustomOrderedDropdown(event, topicIndex, quizzIndex) {
            event.stopPropagation();
            document.querySelectorAll('.custom-select-container').forEach(c => {
                if (c.id !== `custom-ordered-select-${topicIndex}-${quizzIndex}`) {
                    c.classList.remove('open');
                }
            });
            const customSelect = document.getElementById(`custom-ordered-select-${topicIndex}-${quizzIndex}`);
            if (customSelect) {
                customSelect.classList.toggle('open');
            }
        }

        function selectCustomOrderedOption(event, topicIndex, quizzIndex, value, text) {
            if (event && event.stopPropagation) event.stopPropagation();
            const customSelect = document.getElementById(`custom-ordered-select-${topicIndex}-${quizzIndex}`);
            if (!customSelect) return;

            const textSpan = customSelect.querySelector('.custom-select-text');
            const options = customSelect.querySelectorAll('.custom-option');
            
            options.forEach(opt => {
                opt.classList.remove('active');
                if (opt.dataset.value === value) {
                    opt.classList.add('active');
                }
            });
            if (textSpan) textSpan.textContent = text;
            customSelect.classList.remove('open');

            const nativeSelect = document.querySelector(`select[name="quizz[${topicIndex}][${quizzIndex}].ordered"]`);
            if (nativeSelect) {
                nativeSelect.value = value;
                nativeSelect.dispatchEvent(new Event('change'));
            }
        }

        document.addEventListener('click', () => {
            document.querySelectorAll('.custom-select-container').forEach(c => {
                c.classList.remove('open');
            });
        });

        function syncAllCustomSelects() {
            document.querySelectorAll('.custom-select-container').forEach(customSelect => {
                const parent = customSelect.parentElement;
                const nativeSelect = parent.querySelector('select');
                if (nativeSelect) {
                    const val = nativeSelect.value;
                    const options = customSelect.querySelectorAll('.custom-option');
                    const textSpan = customSelect.querySelector('.custom-select-text');
                    options.forEach(opt => {
                        if (opt.dataset.value === val) {
                            options.forEach(o => o.classList.remove('active'));
                            opt.classList.add('active');
                            if (textSpan) textSpan.textContent = opt.textContent;
                        }
                    });
                }
            });
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

                    // Pre-fill common settings fields from shared variant (except ownerName)
                    const fieldsMapping = {
                        'contentVersion': variantData.settings?.contentVersion || '',
                        'ownerIdentifier': variantData.settings?.ownerIdentifier || '',
                        'creatorID': variantData.settings?.creatorID || 0
                    };
                    for (const [id, val] of Object.entries(fieldsMapping)) {
                        const input = document.getElementById(id);
                        if (input) {
                            input.value = val;
                        }
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
