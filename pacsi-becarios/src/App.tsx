import { useState } from 'react';
import { CandidatesPage } from './features/candidates/CandidatesPage';
import { createCandidateRepository } from './services';

export function App() {
  // Instancia estable durante toda la sesión.
  const [repository] = useState(createCandidateRepository);
  return <CandidatesPage repository={repository} />;
}
