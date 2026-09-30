import { useState } from 'react';
import { DocumentsPage } from './features/documents/DocumentsPage';
import { createDocumentRepository } from './services';

export function App() {
  // Instancia estable durante toda la sesión.
  const [repository] = useState(createDocumentRepository);
  return <DocumentsPage repository={repository} />;
}
