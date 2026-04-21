"use client";

import { Person, Relationship } from "@/types";
import { Share2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useDashboard } from "./DashboardContext";
import { MindmapContextData, MindmapNode } from "./MindmapNode";
import MindmapToolbar from "./MindmapToolbar";

import { buildAdjacencyLists } from "@/utils/treeHelpers";

const DEFAULT_AUTO_COLLAPSE_LEVEL = 2;

interface MindmapTreeProps {
  personsMap: Map<string, Person>;
  relationships: Relationship[];
  roots: Person[];
  canEdit?: boolean;
}

interface MindmapContextData {
  personsMap: Map<string, Person>;
  relationships: Relationship[];
  hideSpouses: boolean;
  hideMales: boolean;
  hideFemales: boolean;
  showAvatar: boolean;
  expandSignal: { type: "expand" | "collapse"; ts: number } | null;
  setMemberModalId: (id: string | null) => void;
  maxLevel: number;
}

// Helper function to resolve tree connections for a person
const getTreeData = (personId: string, ctx: MindmapContextData) => {
  const { relationships, personsMap, hideSpouses, hideMales, hideFemales } =
    ctx;
  const spousesList = relationships
    .filter(
      (r) =>
        r.type === "marriage" &&
        (r.person_a === personId || r.person_b === personId),
    )
    .map((r) => {
      const spouseId = r.person_a === personId ? r.person_b : r.person_a;
      return {
        person: personsMap.get(spouseId)!,
        note: r.note,
      };
    })
    .filter((s) => s.person)
    .filter((s) => {
      if (hideSpouses) return false;
      if (hideMales && s.person.gender === "male") return false;
      if (hideFemales && s.person.gender === "female") return false;
      return true;
    });

  const childRels = relationships.filter(
    (r) =>
      (r.type === "biological_child" || r.type === "adopted_child") &&
      r.person_a === personId,
  );

  const childrenList = (
    childRels.map((r) => personsMap.get(r.person_b)).filter(Boolean) as Person[]
  ).filter((c) => {
    if (hideMales && c.gender === "male") return false;
    if (hideFemales && c.gender === "female") return false;
    return true;
  });

  return {
    person: personsMap.get(personId)!,
    spouses: spousesList,
    children: childrenList,
  };
};

const MindmapNode = memo(
  ({
    personId,
    level = 0,
    isLast = false,
    ctx,
  }: {
    personId: string;
    level?: number;
    isLast?: boolean;
    ctx: MindmapContextData;
  }) => {
    const data = getTreeData(personId, ctx);
    const [isExpanded, setIsExpanded] = useState(level < 2);
    const [lastSignalTs, setLastSignalTs] = useState(0);

    if (ctx.expandSignal && ctx.expandSignal.ts !== lastSignalTs) {
      setIsExpanded(ctx.expandSignal.type === "expand");
      setLastSignalTs(ctx.expandSignal.ts);
    }

    if (!data.person) return null;

    const hasChildren = data.children.length > 0;
    const canRenderChildren = level + 1 < ctx.maxLevel;

    return (
      <div className={`relative py-1.5 ${level > 0 ? "pl-6" : "pl-0"}`}>
        {/* Draw the connecting L-shape line from the parent to this node */}
        {level > 0 && (
          <>
            <div
              className="absolute border-l-[1.5px] border-stone-300"
              style={{
                left: "0",
                top: isLast ? "-16px" : "-16px",
                bottom: isLast ? "auto" : "-16px",
                height: isLast ? "40px" : "100%",
              }}
            ></div>
            <div
              className="absolute border-l-[1.5px] border-b-[1.5px] border-stone-300 rounded-bl-xl"
              style={{
                left: "0",
                top: "24px",
                width: "24px",
                height: "24px",
              }}
            ></div>
          </>
        )}

        <div className="flex items-center gap-2 group relative z-10">
          {/* Expand/Collapse Toggle or spacer */}
          <div className="size-5 flex items-center justify-center shrink-0 z-10 bg-transparent">
            {hasChildren ? (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="size-5 flex items-center justify-center bg-white hover:bg-amber-50 border border-stone-200 rounded shadow-sm text-stone-500 hover:text-amber-600 focus:outline-none transition-colors"
                aria-label={isExpanded ? "Thu gọn" : "Mở rộng"}
              >
                {isExpanded ? (
                  <ChevronDown strokeWidth={2.5} className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight strokeWidth={2.5} className="w-3.5 h-3.5" />
                )}
              </button>
            ) : (
              <div className="w-1.5 h-1.5 rounded-full bg-stone-300 ring-2 ring-white"></div>
            )}
          </div>

          {(() => {
            return (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className={`group/card relative flex flex-wrap items-center gap-2 bg-white/60 rounded-2xl border border-stone-200/60 p-2 sm:p-2.5 shadow-sm hover:border-amber-300 hover:shadow-md hover:bg-white/90 transition-all duration-300 overflow-hidden cursor-pointer
                ${data.person.is_deceased ? "opacity-80 grayscale-[0.3]" : ""}`}
                onClick={() => ctx.setMemberModalId(data.person.id)}
              >
                <div className="flex items-center gap-2.5 relative z-10 w-full">
                  <div className="flex flex-1 items-center gap-2.5 min-w-0">
                    {ctx.showAvatar && (
                      <div className="relative shrink-0">
                        <div
                          className={`size-10 rounded-full overflow-hidden flex items-center justify-center text-white text-xs font-bold shadow-md ring-2 ring-white transition-transform duration-300 group-hover/card:scale-105
                    ${
                      data.person.gender === "male"
                        ? "bg-linear-to-br from-sky-400 to-sky-700"
                        : data.person.gender === "female"
                          ? "bg-linear-to-br from-rose-400 to-rose-700"
                          : "bg-linear-to-br from-stone-400 to-stone-600"
                    }`}
                        >
                          {data.person.avatar_url ? (
                            <Image
                              unoptimized
                              src={data.person.avatar_url}
                              alt={data.person.full_name}
                              width={40}
                              height={40}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <DefaultAvatar gender={data.person.gender} />
                          )}
                        </div>
                      </div>
                    )}
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-bold text-[14px] text-stone-900 group-hover/card:text-amber-700 transition-colors leading-tight truncate mb-0.5">
                        {data.person.full_name}
                      </span>
                      <span className="text-[11px] text-stone-500 font-medium truncate flex items-center gap-1">
                        <svg
                          className="size-3 text-stone-400 shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <span className="truncate">
                          {formatDisplayDate(
                            data.person.birth_year,
                            data.person.birth_month,
                            data.person.birth_day,
                          )}
                          {data.person.is_deceased &&
                            ` → ${formatDisplayDate(data.person.death_year, data.person.death_month, data.person.death_day)}`}
                        </span>
                      </span>
                      {(data.person.is_deceased || data.person.is_in_law) && (
                        <div className="flex flex-wrap items-center gap-1 mt-1.5 shrink-0">
                          {data.person.is_in_law && (
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest shadow-xs border ${
                                data.person.gender === "male"
                                  ? "bg-sky-50 text-sky-700 border-sky-200/60"
                                  : data.person.gender === "female"
                                    ? "bg-rose-50 text-rose-700 border-rose-200/60"
                                    : "bg-stone-50 text-stone-700 border-stone-200/60"
                              }`}
                            >
                              {data.person.gender === "male"
                                ? "Rể"
                                : data.person.gender === "female"
                                  ? "Dâu"
                                  : "Khách"}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Spouses attached to node */}
                  {data.spouses.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 ml-1 pl-2 relative before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-px before:h-[70%] before:bg-stone-200/80">
                      {data.spouses.map((spouseData) => {
                        return (
                          <button
                            key={spouseData.person.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              ctx.setMemberModalId(spouseData.person.id);
                            }}
                            className={`flex flex-col items-center gap-1 bg-stone-50/50 hover:bg-white rounded-xl p-1.5 border border-stone-200/60 hover:border-amber-300 transition-all shadow-sm hover:shadow-md group/spouse cursor-pointer
                            ${spouseData.person.is_deceased ? "opacity-80 grayscale-[0.3]" : ""}`}
                            title={
                              spouseData.note ||
                              (spouseData.person.gender === "male"
                                ? "Chồng"
                                : "Vợ")
                            }
                          >
                            {ctx.showAvatar && (
                              <div
                                className={`size-8 rounded-full overflow-hidden flex items-center justify-center text-white text-[10px] font-bold shadow-sm ring-2 ring-white transition-transform duration-300 group-hover/spouse:scale-105
                        ${
                          spouseData.person.gender === "male"
                            ? "bg-linear-to-br from-sky-400 to-sky-700"
                            : spouseData.person.gender === "female"
                              ? "bg-linear-to-br from-rose-400 to-rose-700"
                              : "bg-linear-to-br from-stone-400 to-stone-600"
                        }`}
                              >
                                {spouseData.person.avatar_url ? (
                                  <Image
                                    unoptimized
                                    src={spouseData.person.avatar_url}
                                    alt={spouseData.person.full_name}
                                    width={32}
                                    height={32}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <DefaultAvatar
                                    gender={spouseData.person.gender}
                                  />
                                )}
                              </div>
                            )}
                            <span className="text-[10px] font-bold text-stone-600 truncate max-w-[50px] text-center">
                              {spouseData.person.full_name.split(" ").pop()}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })()}
        </div>

        {/* Children Container */}
        <AnimatePresence initial={false}>
          {hasChildren && isExpanded && canRenderChildren && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="origin-top relative z-0 mt-[-16px] pt-[16px] overflow-hidden"
            >
              <div className="pb-1">
                {data.children.map((child, index) => (
                  <MindmapNode
                    key={child.id}
                    personId={child.id}
                    level={level + 1}
                    isLast={index === data.children.length - 1}
                    ctx={ctx}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  },
);
MindmapNode.displayName = "MindmapNode";

export default function MindmapTree({
  personsMap,
  relationships,
  roots,
  canEdit,
}: MindmapTreeProps) {
  const { showAvatar, setMemberModalId, levelGraph } = useDashboard();
  const [hideDaughtersInLaw, setHideDaughtersInLaw] = useState(false);
  const [hideSonsInLaw, setHideSonsInLaw] = useState(false);
  const [hideDaughters, setHideDaughters] = useState(false);
  const [hideSons, setHideSons] = useState(false);
  const [hideMales, setHideMales] = useState(false);
  const [hideFemales, setHideFemales] = useState(false);
  const [hideExpandButtons, setHideExpandButtons] = useState(false);
  const [autoCollapseLevel, setAutoCollapseLevel] = useState(
    DEFAULT_AUTO_COLLAPSE_LEVEL,
  );
  const [expandSignal, setExpandSignal] = useState<{
    type: "expand" | "collapse";
    ts: number;
  } | null>(null);

  const ctx: MindmapContextData = useMemo(() => {
    const adj = buildAdjacencyLists(relationships, personsMap);

    return {
      personsMap,
      relationships,
      adj,
      hideDaughtersInLaw,
      hideSonsInLaw,
      hideDaughters,
      hideSons,
      hideMales,
      hideFemales,
      showAvatar,
      hideExpandButtons,
      autoCollapseLevel,
      expandSignal,
      setMemberModalId,
    };
  }, [
    personsMap,
    relationships,
    hideDaughtersInLaw,
    hideSonsInLaw,
    hideDaughters,
    hideSons,
    hideMales,
    hideFemales,
    showAvatar,
    hideExpandButtons,
    autoCollapseLevel,
    expandSignal,
    setMemberModalId,
  ]);

  if (roots.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-stone-100 mb-4">
          <Share2 className="size-8 text-stone-300" />
        </div>
        <p className="text-stone-500 font-medium tracking-wide">
          Gia phả trống
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-140px)] flex justify-start lg:justify-center overflow-x-auto">
      <MindmapToolbar
        hideDaughtersInLaw={hideDaughtersInLaw}
        setHideDaughtersInLaw={setHideDaughtersInLaw}
        hideSonsInLaw={hideSonsInLaw}
        setHideSonsInLaw={setHideSonsInLaw}
        hideDaughters={hideDaughters}
        setHideDaughters={setHideDaughters}
        hideSons={hideSons}
        setHideSons={setHideSons}
        hideMales={hideMales}
        setHideMales={setHideMales}
        hideFemales={hideFemales}
        setHideFemales={setHideFemales}
        hideExpandButtons={hideExpandButtons}
        setHideExpandButtons={setHideExpandButtons}
        autoCollapseLevel={autoCollapseLevel}
        setAutoCollapseLevel={setAutoCollapseLevel}
        setExpandSignal={setExpandSignal}
        canEdit={canEdit}
      />

      {/* Root Container */}
      <div
        id="export-container"
        className="font-sans min-w-max pb-20 p-10 px-0 sm:px-8"
      >
        {roots.map((root, index) => (
          <MindmapNode
            key={root.id}
            personId={root.id}
            level={0}
            isLast={index === roots.length - 1}
            ctx={ctx}
          />
        ))}
      </div>
    </div>
  );
}
