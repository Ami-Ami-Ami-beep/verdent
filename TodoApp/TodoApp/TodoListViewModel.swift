import Foundation
import Combine

final class TodoListViewModel: ObservableObject {
    @Published private(set) var items: [TodoItem] = []

    private let storageKey = "todo_items"
    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        load()
    }

    func addItem(title: String) {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        items.insert(TodoItem(title: trimmed), at: 0)
        save()
    }

    func toggleDone(_ item: TodoItem) {
        guard let index = items.firstIndex(where: { $0.id == item.id }) else { return }
        items[index].isDone.toggle()
        save()
    }

    func delete(at offsets: IndexSet) {
        items.remove(atOffsets: offsets)
        save()
    }

    private func load() {
        guard let data = defaults.data(forKey: storageKey),
              let decoded = try? JSONDecoder().decode([TodoItem].self, from: data) else { return }
        items = decoded
    }

    private func save() {
        guard let data = try? JSONEncoder().encode(items) else { return }
        defaults.set(data, forKey: storageKey)
    }
}
