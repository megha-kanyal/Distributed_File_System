import { useState } from 'react'
import './App.css'
import FileManager from './components/FileManager'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <FileManager />
    </>
  )
}

export default App;