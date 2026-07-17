# Backend optionnel : synchronisation, calendrier abonné et Web Push

La version statique reste entièrement utilisable sans serveur. Ce document décrit la prochaine couche lorsque tu voudras synchroniser plusieurs appareils ou garantir les rappels quand l'application est fermée.

## Architecture cible

```text
PWA GitHub Pages
   ├── données locales IndexedDB
   ├── file des changements à synchroniser
   └── abonnement Web Push
            │
            ▼
API légère
   ├── authentification
   ├── sauvegarde chiffrée
   ├── calendrier privé .ics
   ├── abonnements push
   └── rappels programmés
            │
            ▼
Tâche planifiée chaque minute
   └── envoi des notifications arrivées à échéance
```

## Endpoints proposés

### Synchronisation

```text
PUT  /api/state
GET  /api/state?since=<date ISO>
POST /api/sync
```

Chaque objet doit contenir :

```json
{
  "id": "identifiant stable",
  "createdAt": "date ISO",
  "updatedAt": "date ISO",
  "deletedAt": null,
  "deviceId": "identifiant de l'appareil"
}
```

La résolution minimale des conflits peut conserver la version ayant le `updatedAt` le plus récent, tout en enregistrant les deux versions lorsqu'une note a été modifiée sur deux appareils.

### Web Push

```text
POST   /api/push/subscriptions
DELETE /api/push/subscriptions/:id
POST   /api/reminders
DELETE /api/reminders/:id
```

Un rappel serveur peut prendre cette forme :

```json
{
  "id": "reminder_123",
  "userId": "user_123",
  "elementType": "event",
  "elementId": "event_456",
  "occurrenceAt": "2026-07-20T18:00:00+02:00",
  "notifyAt": "2026-07-20T17:30:00+02:00",
  "timeZone": "Europe/Paris",
  "status": "scheduled",
  "payload": {
    "title": "Séance de sport",
    "body": "Dans 30 minutes",
    "url": "/index.html?screen=agenda&date=2026-07-20"
  }
}
```

Le service worker v5 accepte déjà un message push au format :

```json
{
  "title": "Mon Quotidien",
  "body": "Ton rendez-vous commence dans 30 minutes.",
  "tag": "event_456_2026-07-20",
  "url": "./index.html?screen=agenda&date=2026-07-20"
}
```

## Calendrier Apple abonné

Endpoint proposé :

```text
GET /calendar/<jeton-secret>.ics
```

Le jeton doit être :

- long et impossible à deviner ;
- révocable depuis les réglages ;
- différent du mot de passe ;
- traité comme une information confidentielle.

Le flux peut être ajouté sur l'iPhone comme calendrier abonné. Il est principalement destiné à la lecture ; les modifications continuent d'être réalisées dans Mon Quotidien.

## Sécurité minimale

- HTTPS obligatoire ;
- authentification par lien magique ou passkey ;
- chiffrement des sauvegardes sensibles ;
- aucune clé privée ou secret dans le dépôt GitHub Pages ;
- limitation du nombre de requêtes ;
- journalisation des connexions et révocation des appareils ;
- sauvegarde automatique de la base distante.

## Intégration native Apple ultérieure

Une synchronisation bidirectionnelle complète avec Calendrier et Rappels Apple nécessite une petite application iOS utilisant EventKit. L'interface web actuelle peut être conservée dans une enveloppe native, avec un pont limité aux opérations autorisées :

```text
readCalendars()
createEvent()
updateEvent()
deleteEvent()
createReminder()
```

Cette étape est indépendante de la version PWA et peut être ajoutée plus tard sans réécrire la logique métier.
