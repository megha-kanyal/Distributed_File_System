import { useState } from 'react'
import './App.css'
import FileManager from './components/FileManager';

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
       <div className="App">
      <h1>Distributed File System</h1>
      <FileManager />
    </div>
    </>
  )
}

export default App