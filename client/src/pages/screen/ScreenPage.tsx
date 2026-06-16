import { useParams } from "react-router-dom";
export default function ScreenPage() {
  const { slug } = useParams();
  return <div><h1>Screen: {slug}</h1><p>Screen Display — to be implemented (D: projection)</p></div>;
}
