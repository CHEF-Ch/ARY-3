import { useParams } from "react-router-dom";
export default function ResultsPage() {
  const { slug } = useParams();
  return <div><h1>Results: {slug}</h1><p>Results Page — to be implemented (C: portfolio)</p></div>;
}
