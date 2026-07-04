# TodoApp

Eine einfache To-Do-App für iOS, gebaut mit SwiftUI.

## Funktionen

- Aufgaben hinzufügen
- Aufgaben als erledigt markieren
- Aufgaben löschen (Swipe oder Bearbeiten-Modus)
- Aufgaben werden lokal gespeichert (`UserDefaults`) und bleiben nach Neustart erhalten

## Projektstruktur

- `TodoApp/TodoApp.swift` – App-Einstiegspunkt
- `TodoApp/ContentView.swift` – Aufgabenliste
- `TodoApp/AddTodoView.swift` – Formular zum Hinzufügen einer Aufgabe
- `TodoApp/TodoItem.swift` – Datenmodell
- `TodoApp/TodoListViewModel.swift` – State-Management und Persistenz

## Öffnen und Ausführen

1. `TodoApp.xcodeproj` in Xcode (15 oder neuer) öffnen
2. Einen iOS-Simulator auswählen
3. Mit `Cmd+R` bauen und starten

Benötigt iOS 17.0+ als Deployment-Target.
