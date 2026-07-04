import SwiftUI

struct ContentView: View {
    @StateObject private var viewModel = TodoListViewModel()
    @State private var isShowingAddSheet = false

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.items.isEmpty {
                    ContentUnavailableView(
                        "Keine Aufgaben",
                        systemImage: "checkmark.circle",
                        description: Text("Tippe auf +, um deine erste Aufgabe hinzuzufügen.")
                    )
                } else {
                    List {
                        ForEach(viewModel.items) { item in
                            TodoRow(item: item) {
                                viewModel.toggleDone(item)
                            }
                        }
                        .onDelete(perform: viewModel.delete)
                    }
                }
            }
            .navigationTitle("Aufgaben")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        isShowingAddSheet = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
                if !viewModel.items.isEmpty {
                    ToolbarItem(placement: .topBarLeading) {
                        EditButton()
                    }
                }
            }
            .sheet(isPresented: $isShowingAddSheet) {
                AddTodoView { title in
                    viewModel.addItem(title: title)
                }
            }
        }
    }
}

private struct TodoRow: View {
    let item: TodoItem
    let onToggle: () -> Void

    var body: some View {
        Button(action: onToggle) {
            HStack {
                Image(systemName: item.isDone ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(item.isDone ? .green : .secondary)
                Text(item.title)
                    .strikethrough(item.isDone)
                    .foregroundStyle(item.isDone ? .secondary : .primary)
                Spacer()
            }
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    ContentView()
}
