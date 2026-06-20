import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../App";
import type { WorkResponse, JudgingRecordResponse, JudgeAssignmentResponse, AwardResponse } from "../../shared/apiTypes";
import { requestJson } from "../../shared/apiTypes";

interface AwardForm {
  registrationId: string;
  workId: string;
  awardName: string;
  rank: string;
  decisionReason: string;
  judgingRecordIds: string;
}

const emptyAwardForm: AwardForm = {
  registrationId: "",
  workId: "",
  awardName: "",
  rank: "",
  decisionReason: "",
  judgingRecordIds: "",
};

export default function OrganizerJudging() {
  const { user } = useAuth();
  const [works, setWorks] = useState<WorkResponse[]>([]);
  const [assignments, setAssignments] = useState<JudgeAssignmentResponse[]>([]);
  const [awards, setAwards] = useState<AwardResponse[]>([]);
  const [selectedWorkId, setSelectedWorkId] = useState("");
  const [raceIdFilter, setRaceIdFilter] = useState("");
  const [judgeUserId, setJudgeUserId] = useState("");
  const [awardForm, setAwardForm] = useState<AwardForm>(emptyAwardForm);
  const [editingAwardId, setEditingAwardId] = useState("");
  const [message, setMessage] = useState("");
  const [awardMessage, setAwardMessage] = useState("");
  const [loadingWorks, setLoadingWorks] = useState(false);
  const [loadingAwards, setLoadingAwards] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedWork = works.find((work) => work.id === selectedWorkId) || works[0];
  const activeRaceId = selectedWork?.raceId || raceIdFilter.trim();
  const selectedAssignments = assignments.filter((assignment) => assignment.workId === selectedWork?.id);

  const progressRows = useMemo(
    () =>
      works.map((work) => {
        const workAssignments = assignments.filter((assignment) => assignment.workId === work.id);
        const submitted = workAssignments.filter((assignment) => assignment.judgingRecord?.status === "submitted").length;
        return { work, assigned: workAssignments.length, submitted };
      }),
    [assignments, works],
  );

  useEffect(() => {
    if (!user) return;
    loadWorks();
  }, [user]);

  useEffect(() => {
    if (!user || !activeRaceId) {
      setAwards([]);
      return;
    }
    loadAwards(activeRaceId);
  }, [user, activeRaceId]);

  useEffect(() => {
    if (!user || works.length === 0) {
      setAssignments([]);
      return;
    }
    loadAssignmentsForWorks(works);
  }, [user, works]);

  if (!user) {
    return (
      <div style={panelStyle}>
        <h1 style={titleStyle}>评审与奖项</h1>
        <p style={muted}>请先登录</p>
      </div>
    );
  }

  async function loadWorks() {
    setLoadingWorks(true);
    setError("");
    setMessage("");
    try {
      const query = raceIdFilter.trim() ? `?raceId=${encodeURIComponent(raceIdFilter.trim())}` : "";
      const data = await requestJson<WorkResponse[]>(`/works${query}`);
      setWorks(data);
      setSelectedWorkId((current) => (data.some((work) => work.id === current) ? current : data[0]?.id || ""));
    } catch (err) {
      setWorks([]);
      setSelectedWorkId("");
      setError(err instanceof Error ? err.message : "作品加载失败。");
    } finally {
      setLoadingWorks(false);
    }
  }

  async function loadAwards(raceId: string) {
    setLoadingAwards(true);
    setAwardMessage("");
    try {
      const data = await requestJson<AwardResponse[]>(`/awards?raceId=${encodeURIComponent(raceId)}`);
      setAwards(data);
    } catch (err) {
      setAwards([]);
      setAwardMessage(err instanceof Error ? err.message : "奖项加载失败。");
    } finally {
      setLoadingAwards(false);
    }
  }

  async function loadAssignmentsForWorks(rows: WorkResponse[]) {
    try {
      const nested = await Promise.all(
        rows.map((work) =>
          requestJson<JudgeAssignmentResponse[]>(`/works/${work.id}/judge-assignments`).catch(() => []),
        ),
      );
      setAssignments(nested.flat());
    } catch {
      setAssignments([]);
    }
  }

  async function lockWork(workId: string) {
    setSaving(true);
    setMessage("");
    try {
      const updated = await requestJson<WorkResponse>(`/works/${workId}/lock`, { method: "POST" });
      upsertWork(updated);
      setMessage("作品已锁定。");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "锁定作品失败。");
    } finally {
      setSaving(false);
    }
  }

  async function publishWork(workId: string) {
    setSaving(true);
    setMessage("");
    try {
      const updated = await requestJson<WorkResponse>(`/works/${workId}/publish`, { method: "POST" });
      upsertWork(updated);
      setMessage("作品已发布。");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "发布作品失败。");
    } finally {
      setSaving(false);
    }
  }

  async function assignJudge() {
    if (!selectedWork || !judgeUserId.trim()) {
      setMessage("请输入 githubAccount 或 judgeUserId。");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const input = judgeUserId.trim();
      // If the input doesn't look like a UUID (no hyphens), treat it as githubAccount
      const isUuid = input.includes("-");
      const body = isUuid ? { judgeUserId: input } : { githubAccount: input };
      const assignment = await requestJson<JudgeAssignmentResponse>(`/works/${selectedWork.id}/judge-assignments`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setAssignments((current) =>
        current.some((item) => item.id === assignment.id) ? current : [...current, assignment],
      );
      setJudgeUserId("");
      setMessage("评委已分配。");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "分配评委失败。");
    } finally {
      setSaving(false);
    }
  }

  async function removeAssignment(assignmentId: string) {
    setSaving(true);
    setMessage("");
    try {
      await requestJson<{ ok: boolean }>(`/judge-assignments/${assignmentId}`, { method: "DELETE" });
      setAssignments((current) => current.filter((item) => item.id !== assignmentId));
      setMessage("分配已删除。");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "删除分配失败。");
    } finally {
      setSaving(false);
    }
  }

  async function submitAwardForm() {
    const rank = Number(awardForm.rank);
    if (!awardForm.registrationId.trim() || !awardForm.awardName.trim() || !Number.isInteger(rank) || rank <= 0) {
      setAwardMessage("registrationId、awardName 和正整数 rank 为必填。");
      return;
    }

    setSaving(true);
    setAwardMessage("");
    try {
      const judgingRecordIds = parseIdList(awardForm.judgingRecordIds);
      const award = editingAwardId
        ? await requestJson<AwardResponse>(`/awards/${editingAwardId}`, {
            method: "PATCH",
            body: JSON.stringify({
              awardName: awardForm.awardName.trim(),
              rank,
              decisionReason: awardForm.decisionReason,
              judgingRecordIds,
            }),
          })
        : await requestJson<AwardResponse>("/awards", {
            method: "POST",
            body: JSON.stringify({
              registrationId: awardForm.registrationId.trim(),
              workId: awardForm.workId.trim() || undefined,
              awardName: awardForm.awardName.trim(),
              rank,
              decisionReason: awardForm.decisionReason,
              judgingRecordIds,
            }),
          });

      setAwards((current) => upsertById(current, award));
      setAwardMessage(editingAwardId ? "Award 草稿已更新。" : "Award 草稿已创建。");
      setAwardForm(emptyAwardForm);
      setEditingAwardId("");
    } catch (err) {
      setAwardMessage(err instanceof Error ? err.message : "保存 Award 失败。");
    } finally {
      setSaving(false);
    }
  }

  function editAward(award: AwardResponse) {
    if (award.status !== "draft") return;
    setEditingAwardId(award.id);
    setAwardForm({
      registrationId: award.registrationId,
      workId: award.workId || "",
      awardName: award.awardName,
      rank: String(award.rank),
      decisionReason: award.decisionReason,
      judgingRecordIds: award.judgingRecordIds.join(", "),
    });
    setAwardMessage("正在编辑 Award 草稿。registrationId 和 workId 由后端创建记录时确定，编辑时不会修改。");
  }

  async function publishAward(awardId: string) {
    setSaving(true);
    setAwardMessage("");
    try {
      const award = await requestJson<AwardResponse>(`/awards/${awardId}/publish`, { method: "POST" });
      setAwards((current) => upsertById(current, award));
      setAwardMessage("Award 已发布。");
    } catch (err) {
      setAwardMessage(err instanceof Error ? err.message : "发布 Award 失败。");
    } finally {
      setSaving(false);
    }
  }

  function upsertWork(work: WorkResponse) {
    setWorks((current) => upsertById(current, work));
  }

  return (
    <div>
      <h1 style={titleStyle}>评审与奖项</h1>
      <p style={muted}>当前用户：{user.displayName || user.userId}，这里管理当前账号有权限读取的作品、评委分配和 Award。</p>

      <section style={panelStyle}>
        <h2 style={sectionTitleStyle}>作品管理</h2>
        <div style={filterRowStyle}>
          <input
            value={raceIdFilter}
            onChange={(event) => setRaceIdFilter(event.target.value)}
            placeholder="raceId（留空读取可见作品）"
            style={inputStyle}
          />
          <button disabled={loadingWorks || saving} onClick={loadWorks} style={secondaryButtonStyle}>加载作品</button>
        </div>

        {loadingWorks ? <p style={muted}>正在加载作品...</p> : null}
        {error ? <p style={errorStyle}>{error}</p> : null}
        {message ? <p style={messageStyle}>{message}</p> : null}
        {!loadingWorks && !error && works.length === 0 ? <p style={muted}>当前没有可管理的作品。</p> : null}

        <div style={workGridStyle}>
          {works.map((work) => (
            <article key={work.id} style={workCardStyle}>
              <button
                onClick={() => setSelectedWorkId(work.id)}
                style={{
                  ...selectButtonStyle,
                  border: selectedWork?.id === work.id ? "2px solid #075bec" : selectButtonStyle.border,
                }}
              >
                <strong>{work.title}</strong>
                <span>状态：{formatWorkStatus(work.status)}</span>
                <span>可见性：{formatVisibility(work.visibility)}</span>
                <span>Race ID：{work.raceId}</span>
              </button>
              {work.reviewWarnings.length ? (
                <p style={warningTextStyle}>风险提示：{work.reviewWarnings.length} 条</p>
              ) : (
                <p style={muted}>暂无评审前风险提示。</p>
              )}
              <div style={actionRowStyle}>
                {work.status !== "locked" ? (
                  <button disabled={saving} onClick={() => lockWork(work.id)} style={secondaryButtonStyle}>
                    锁定
                  </button>
                ) : (
                  <span style={{ ...muted, fontSize: 13 }}>已锁定</span>
                )}
                <button
                  disabled={saving || (work.status !== "submitted" && work.status !== "locked")}
                  onClick={() => publishWork(work.id)}
                  style={primaryButtonStyle}
                >
                  发布
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div style={twoColumnStyle}>
        <section style={panelStyle}>
          <h2 style={sectionTitleStyle}>评委分配</h2>
          <p style={muted}>当前作品：{selectedWork?.title || "未选择作品"}</p>
          <div style={inlineFormStyle}>
            <input
              value={judgeUserId}
              onChange={(event) => setJudgeUserId(event.target.value)}
              placeholder="githubAccount（如 recyclable06）"
              style={inputStyle}
            />
            <button disabled={saving || !selectedWork} onClick={assignJudge} style={primaryButtonStyle}>分配</button>
          </div>
          <div style={listStyle}>
            {selectedAssignments.length === 0 ? <p style={muted}>当前作品暂无分配。</p> : null}
            {selectedAssignments.map((assignment) => (
              <div key={assignment.id} style={rowStyle}>
                <strong>{assignment.judgeGithubAccount || assignment.judgeUserId}</strong>
                <span>{formatRecordStatus(assignment.judgingRecord?.status)}</span>
                <button
                  disabled={saving || assignment.judgingRecord?.status === "submitted"}
                  onClick={() => removeAssignment(assignment.id)}
                  style={textButtonStyle}
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        </section>

        <section style={panelStyle}>
          <h2 style={sectionTitleStyle}>评审进度</h2>
          <div style={listStyle}>
            {progressRows.length === 0 ? <p style={muted}>暂无作品进度。</p> : null}
            {progressRows.map(({ work, assigned, submitted }) => (
              <div key={work.id} style={progressRowStyle}>
                <strong>{work.title}</strong>
                <span>{submitted} / {assigned} 已提交</span>
                <span>风险：{work.reviewWarnings.length} 条</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section style={{ ...panelStyle, marginTop: 16 }}>
        <h2 style={sectionTitleStyle}>奖项管理</h2>
        <p style={muted}>当前 Race：{activeRaceId || "未选择"}</p>
        {loadingAwards ? <p style={muted}>正在加载 Award...</p> : null}
        {awardMessage ? <p style={messageStyle}>{awardMessage}</p> : null}
        <div style={awardLayoutStyle}>
          <div style={formStyle}>
            <label style={labelStyle}>
              registrationId
              <input value={awardForm.registrationId} readOnly={!!editingAwardId} onChange={(event) => setAwardFormField("registrationId", event.target.value, setAwardForm)} style={editingAwardId ? { ...inputStyle, opacity: 0.55 } : inputStyle} />
            </label>
            <label style={labelStyle}>
              workId（可选）
              <input value={awardForm.workId} readOnly={!!editingAwardId} onChange={(event) => setAwardFormField("workId", event.target.value, setAwardForm)} style={editingAwardId ? { ...inputStyle, opacity: 0.55 } : inputStyle} />
            </label>
            <label style={labelStyle}>
              awardName
              <input value={awardForm.awardName} onChange={(event) => setAwardFormField("awardName", event.target.value, setAwardForm)} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              rank（正整数）
              <input type="number" min={1} value={awardForm.rank} onChange={(event) => setAwardFormField("rank", event.target.value, setAwardForm)} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              decisionReason
              <textarea value={awardForm.decisionReason} onChange={(event) => setAwardFormField("decisionReason", event.target.value, setAwardForm)} style={textareaStyle} />
            </label>
            <label style={labelStyle}>
              judgingRecordIds（逗号分隔）
              <input value={awardForm.judgingRecordIds} onChange={(event) => setAwardFormField("judgingRecordIds", event.target.value, setAwardForm)} style={inputStyle} />
            </label>
            <div style={actionRowStyle}>
              <button disabled={saving} onClick={submitAwardForm} style={primaryButtonStyle}>{editingAwardId ? "保存草稿" : "创建 Award"}</button>
              {editingAwardId ? (
                <button
                  disabled={saving}
                  onClick={() => {
                    setEditingAwardId("");
                    setAwardForm(emptyAwardForm);
                    setAwardMessage("");
                  }}
                  style={secondaryButtonStyle}
                >
                  取消编辑
                </button>
              ) : null}
            </div>
          </div>

          <div style={listStyle}>
            {awards.length === 0 && !loadingAwards ? <p style={muted}>当前 Race 暂无 Award。</p> : null}
            {awards.map((award) => (
              <article key={award.id} style={awardItemStyle}>
                <div>
                  <strong>{award.awardName} #{award.rank}</strong>
                  <p style={muted}>{award.registrationId}{award.workId ? ` / ${award.workId}` : ""}</p>
                  <p style={muted}>{award.decisionReason || "暂无决策说明。"}</p>
                </div>
                <span>{formatAwardStatus(award.status)}</span>
                <div style={actionRowStyle}>
                  <button disabled={saving || award.status !== "draft"} onClick={() => editAward(award)} style={secondaryButtonStyle}>编辑</button>
                  <button disabled={saving || award.status !== "draft"} onClick={() => publishAward(award.id)} style={primaryButtonStyle}>发布</button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function upsertById<T extends { id: string }>(rows: T[], row: T) {
  return rows.some((item) => item.id === row.id) ? rows.map((item) => (item.id === row.id ? row : item)) : [row, ...rows];
}

function parseIdList(value: string) {
  return value
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function setAwardFormField(
  key: keyof AwardForm,
  value: string,
  setAwardForm: React.Dispatch<React.SetStateAction<AwardForm>>,
) {
  setAwardForm((current) => ({ ...current, [key]: value }));
}

function formatWorkStatus(status: WorkResponse["status"]) {
  if (status === "draft") return "草稿";
  if (status === "submitted") return "已提交";
  if (status === "locked") return "已锁定";
  return "已隐藏";
}

function formatVisibility(visibility: WorkResponse["visibility"]) {
  return visibility === "public" ? "公开" : "私有";
}

function formatRecordStatus(status: string | undefined) {
  if (status === "draft") return "草稿";
  if (status === "submitted") return "已提交";
  return "未提交";
}

function formatAwardStatus(status: AwardResponse["status"]) {
  return status === "published" ? "已发布" : "草稿";
}

const titleStyle: React.CSSProperties = {
  margin: "0 0 8px",
  fontSize: 28,
  color: "#06164a",
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

const filterRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(240px, 1fr) auto",
  gap: 10,
  marginBottom: 12,
};

const workGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
  gap: 12,
};

const workCardStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 12,
  border: "1px solid rgba(34,107,230,0.12)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.70)",
};

const selectButtonStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  width: "100%",
  padding: 10,
  textAlign: "left",
  border: "1px solid rgba(34,107,230,0.14)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.74)",
  color: "#06164a",
  cursor: "pointer",
};

const twoColumnStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(320px, 1fr) minmax(320px, 1fr)",
  gap: 16,
  marginTop: 16,
};

const awardLayoutStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(280px, 0.8fr) minmax(360px, 1.2fr)",
  gap: 16,
};

const inlineFormStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 10,
  margin: "12px 0",
};

const formStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const listStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const rowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 90px 70px",
  alignItems: "center",
  gap: 10,
  padding: 10,
  border: "1px solid rgba(34,107,230,0.12)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.70)",
};

const progressRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 110px 90px",
  gap: 10,
  padding: 10,
  border: "1px solid rgba(34,107,230,0.12)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.70)",
};

const awardItemStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 80px 150px",
  gap: 12,
  alignItems: "start",
  padding: 12,
  border: "1px solid rgba(34,107,230,0.12)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.70)",
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
  minHeight: 88,
  resize: "vertical",
};

const actionRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "9px 12px",
  border: "none",
  borderRadius: 8,
  background: "#0b5ee8",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "9px 12px",
  border: "1px solid rgba(34,107,230,0.22)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.82)",
  color: "#075bec",
  fontWeight: 800,
  cursor: "pointer",
};

const textButtonStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#075bec",
  fontWeight: 800,
  cursor: "pointer",
};

const warningTextStyle: React.CSSProperties = {
  margin: 0,
  color: "#7a4a00",
  fontSize: 13,
  fontWeight: 800,
};

const messageStyle: React.CSSProperties = {
  margin: "10px 0",
  color: "#075bec",
  fontWeight: 800,
};

const errorStyle: React.CSSProperties = {
  margin: "10px 0",
  color: "#b42318",
  fontWeight: 800,
};

const muted: React.CSSProperties = {
  margin: 0,
  color: "#53668d",
};
