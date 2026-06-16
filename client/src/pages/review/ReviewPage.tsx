import { useParams } from "react-router-dom";
export default function ReviewPage() {
  const { slug } = useParams();
  return <div><h1>Review: {slug}</h1><p>Review Page — to be implemented (E: report-gen)</p></div>;
}
