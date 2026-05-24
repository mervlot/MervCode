   const customKeymap = [
      {
        key: "Ctrl-s",
        run: () => {
          console.log("save")
          return true
        },
      },

      {
        key: "Tab",
        run: (view) => {
          view.dispatch(
            view.state.replaceSelection("  ")
          )
          return true
        },
      },

      {
        key: "Ctrl-l",
        run: (view) => {
          const line = view.state.doc.lineAt(view.state.selection.main.head)

          view.dispatch({
            changes: {
              from: line.from,
              to: line.to,
              insert: "",
            },
          })

          return true
        },
      },
    ]
export{
    customKeymap
}