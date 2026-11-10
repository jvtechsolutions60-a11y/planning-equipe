# Tâches ajoutées par Claude

Quand vous dictez une tâche à Claude, il dépose ici un fichier `.json` et l'action GitHub « Ajouter des tâches » l'écrit dans le planning (moins d'une minute). Format : voir `scripts/ajouter-taches.mjs`. Une tâche n'est jamais ajoutée deux fois : si vous la modifiez ou la supprimez dans le planning, le fichier ne la recrée pas.
