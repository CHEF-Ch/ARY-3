import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../App";
import type { ReviewWarning, WorkResponse, JudgingRecordResponse, JudgeAssignmentResponse } from "../../shared/apiTypes";
import { requestJson } from "../../shared/apiTypes";

export default function JudgeView() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<JudgeAssignmentResponse[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [scoreResult, setScoreResult] = useState("");
  const [scoreRiding, setScoreRiding] = useState("");
  const [comments, setComments] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedAssignment = useMemo(
    () => assignments.find((assignment) => assignment.id === selectedAssignmentId) || assignments[0],
    [assignments, selectedAssignmentId],
  );

  const submittedRecords = useMemo(
    () => assignments.filter((assignment) => assignment.judgingRecord?.status === "submitted"),
    [assignments],
  );

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    setError("");
    requestJson<JudgeAssignmentResponse[]>("/judge-assignments/mine")
      .then((data) => {
        setAssignments(data);
        setSelectedAssignmentId((current) => current || data[0]?.id || "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "加载评审分配失败。"))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    const record = selectedAssignment?.judgingRecord;
    setScoreResult(record?.scoreResult === null || record?.scoreResult === undefined ? "" : String(record.scoreResult));
    setScoreRiding(record?.scoreRiding === null || record?.scoreRiding === undefined ? "" : String(record.scoreRiding));
    setComments(record?.comments || "");
    // message is managed by individual actions (saveDraft / submitReview) — not cleared here
  }, [selectedAssignment]);

  if (!user) {
    return (
      <div style={panelStyle}>
        <h1 style={titleStyle}>评委视图</h1>
        <p style={muted}>请先登录</p>
      </div>
    );
  }

  const recordStatus = selectedAssignment?.judgingRecord?.status || "未开始";
  const readonly = selectedAssignment?.judgingRecord?.status === "submitted";

  const upsertAssignmentRecord = (assignmentId: string, record: JudgingRecordResponse) => {
    setAssignments((current) =>
      current.map((assignment) =>
        assignment.id === assignmentId ? { ...assignment, judgingRecord: record } : assignment,
      ),
    );
  };

  const saveDraft = async () => {
    if (!selectedAssignment || readonly) return null;

    setSaving(true);
    setMessage("");
    try {
      const payload = buildRecordPayload();
      const record = selectedAssignment.judgingRecord
        ? await requestJson<JudgingRecordResponse>(`/judging-records/${selectedAssignment.judgingRecord.id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await requestJson<JudgingRecordResponse>(`/judge-assignments/${selectedAssignment.id}/judging-records`, {
            method: "POST",
            body: JSON.stringify(payload),
          });
      upsertAssignmentRecord(selectedAssignment.id, record);
      setMessage("草稿已保存。");
      return record;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "保存草稿失败。");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const submitReview = async () => {
    if (!selectedAssignment || readonly) return;
    if (!scoreResult || !scoreRiding) {
      setMessage("赛果评分和骑行评分不能为空。");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const payload = buildRecordPayload();
      const draft = selectedAssignment.judgingRecord
        ? await requestJson<JudgingRecordResponse>(`/judging-records/${selectedAssignment.judgingRecord.id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await requestJson<JudgingRecordResponse>(`/judge-assignments/${selectedAssignment.id}/judging-records`, {
            method: "POST",
            body: JSON.stringify(payload),
          });
      // Persist the draft locally before attempting submit so that a
      // retry on failure picks up the draft record and uses PATCH.
      upsertAssignmentRecord(selectedAssignment.id, draft);
      const submitted = await requestJson<JudgingRecordResponse>(`/judging-records/${draft.id}/submit`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      upsertAssignmentRecord(selectedAssignment.id, submitted);
      setMessage("评审已提交。");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "提交评审失败。");
    } finally {
      setSaving(false);
    }
  };

  const buildRecordPayload = () => {
    const payload: { scoreResult?: number; scoreRiding?: number; comments: string } = { comments };
    if (scoreResult !== "") payload.scoreResult = Number(scoreResult);
    if (scoreRiding !== "") payload.scoreRiding = Number(scoreRiding);
    return payload;
  };

  return (
    <div>
      <h1 style={titleStyle}>评委视图</h1>
      <p style={muted}>当前用户：{user.displayName || user.userId}，这里展示当前评委的分配、草稿和已提交记录。</p>

      {loading ? <p style={muted}>正在加载评审分配...</p> : null}
      {error ? <p style={errorStyle}>{error}</p> : null}

      {!loading && !error && assignments.length === 0 ? (
        <section style={panelStyle}>
          <h2 style={sectionTitleStyle}>我的分配</h2>
          <p style={muted}>当前没有分配给你的评审任务。</p>
        </section>
      ) : null}

      {assignments.length > 0 ? (
        <>
          <div style={layoutStyle}>
            <section style={panelStyle}>
              <h2 style={sectionTitleStyle}>我的分配</h2>
              <div style={assignmentListStyle}>
                {assignments.map((assignment) => (
                  <button
                    key={assignment.id}
                    onClick={() => {
                      setSelectedAssignmentId(assignment.id);
                      setMessage("");
                    }}
                    style={{
                      ...assignmentButtonStyle,
                      border: assignment.id === selectedAssignment?.id ? "2px solid #075bec" : assignmentButtonStyle.border,
                      background: assignment.id === selectedAssignment?.id ? "rgba(234,243,255,0.92)" : assignmentButtonStyle.background,
                    }}
                  >
                    <strong>{assignment.work?.title || assignment.workId}</strong>
                    <span>评审状态：{formatRecordStatus(assignment.judgingRecord?.status)}</span>
                    <span>风险提示：{assignment.work?.reviewWarnings.length || 0} 条</span>
                  </button>
                ))}
              </div>
            </section>

            <section style={panelStyle}>
              <h2 style={sectionTitleStyle}>评分表单</h2>
              {selectedAssignment ? (
                <div style={formStyle}>
                  <div style={workSummaryStyle}>
                    <strong>{selectedAssignment.work?.title || selectedAssignment.workId}</strong>
                    <span>当前状态：{formatRecordStatus(recordStatus)}</span>
                  </div>

                  {selectedAssignment.work?.reviewWarnings.length ? (
                    <div style={warningBoxStyle}>
                      {selectedAssignment.work.reviewWarnings.map((warning) => (
                        <div key={`${warning.registrationId}-${warning.code}`}>
                          <strong>{warning.code}</strong>
                          <p style={{ margin: "4px 0 0" }}>{warning.message}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={muted}>当前作品没有评审前风险提示。</p>
                  )}

                  <label style={labelStyle}>
                    赛果评分（0-100）
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={scoreResult}
                      readOnly={readonly || saving}
                      onChange={(event) => setScoreResult(event.target.value)}
                      style={inputStyle}
                    />
                  </label>
                  <label style={labelStyle}>
                    骑行评分（0-100）
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={scoreRiding}
                      readOnly={readonly || saving}
                      onChange={(event) => setScoreRiding(event.target.value)}
                      style={inputStyle}
                    />
                  </label>
                  <label style={labelStyle}>
                    评审意见
                    <textarea
                      value={comments}
                      readOnly={readonly || saving}
                      onChange={(event) => setComments(event.target.value)}
                      style={textareaStyle}
                    />
                  </label>
                  <div style={actionRowStyle}>
                    <button disabled={readonly || saving} onClick={saveDraft} style={secondaryButtonStyle}>
                      保存草稿
                    </button>
                    <button disabled={readonly || saving} onClick={submitReview} style={primaryButtonStyle}>
                      提交评审
                    </button>
                  </div>
                  {message ? <p style={messageStyle}>{message}</p> : null}
                </div>
              ) : (
                <p style={muted}>请选择一个分配。</p>
              )}
            </section>
          </div>

          <section style={{ ...panelStyle, marginTop: 16 }}>
            <h2 style={sectionTitleStyle}>已提交评审</h2>
            {submittedRecords.length === 0 ? (
              <p style={muted}>当前评委暂无已提交评审。</p>
            ) : (
              <div style={submittedListStyle}>
                {submittedRecords.map((assignment) => (
                  <div key={assignment.id} style={submittedItemStyle}>
                    <strong>{assignment.work?.title || assignment.workId}</strong>
                    <span>赛果评分：{assignment.judgingRecord?.scoreResult}</span>
                    <span>骑行评分：{assignment.judgingRecord?.scoreRiding}</span>
                    <p style={{ ...muted, margin: 0, gridColumn: "1 / -1" }}>{assignment.judgingRecord?.comments}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function formatRecordStatus(status: string | undefined) {
  if (status === "draft") return "草稿";
  if (status === "submitted") return "已提交";
  return "未开始";
}

const titleStyle: React.CSSProperties = {
  margin: "0 0 8px",
  fontSize: 28,
  color: "#06164a",
};

const layoutStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(260px, 0.9fr) minmax(360px, 1.4fr)",
  gap: 16,
  marginTop: 20,
};

const panelStyle: React.CSSProperties = {
  padding: 20,
  border: "1px solid rgba(34,107,230,0.18)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.72)",
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "0 0 12px",
  fontSize: 20,
  color: "#06164a",
};

const assignmentListStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const assignmentButtonStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  width: "100%",
  textAlign: "left",
  padding: 12,
  border: "1px solid rgba(34,107,230,0.14)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.72)",
  color: "#06164a",
  cursor: "pointer",
};

const formStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const workSummaryStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: 12,
  borderRadius: 8,
  background: "rgba(234,243,255,0.72)",
  color: "#06164a",
};

const warningBoxStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  padding: 12,
  border: "1px solid rgba(186,112,0,0.24)",
  borderRadius: 8,
  background: "rgba(255,249,235,0.84)",
  color: "#7a4a00",
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  color: "#53668d",
  fontSize: 13,
  fontWeight: 800,
};

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid rgba(34,107,230,0.18)",
  borderRadius: 8,
  color: "#06164a",
  fontSize: 14,
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 96,
  resize: "vertical",
};

const actionRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  border: "none",
  borderRadius: 8,
  background: "#0b5ee8",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  border: "1px solid rgba(34,107,230,0.22)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.82)",
  color: "#075bec",
  fontWeight: 800,
  cursor: "pointer",
};

const submittedListStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const submittedItemStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 140px 140px",
  gap: 12,
  padding: 12,
  border: "1px solid rgba(34,107,230,0.12)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.70)",
};

const messageStyle: React.CSSProperties = {
  margin: 0,
  color: "#075bec",
  fontWeight: 800,
};

const errorStyle: React.CSSProperties = {
  margin: "12px 0",
  color: "#b42318",
  fontWeight: 800,
};

const muted: React.CSSProperties = {
  margin: 0,
  color: "#53668d",
};
