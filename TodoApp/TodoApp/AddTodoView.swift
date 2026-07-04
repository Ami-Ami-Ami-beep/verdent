import SwiftUI

struct AddTodoView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var title: String = ""
    let onAdd: (String) -> Void

    var body: some View {
        NavigationStack {
            Form {
                TextField("Was gibt es zu tun?", text: $title)
            }
            .navigationTitle("Neue Aufgabe")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Speichern") {
                        onAdd(title)
                        dismiss()
                    }
                    .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }
}

#Preview {
    AddTodoView(onAdd: { _ in })
}
