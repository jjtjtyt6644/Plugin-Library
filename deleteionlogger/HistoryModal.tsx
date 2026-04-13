/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import ErrorBoundary from "@components/ErrorBoundary";
import { TooltipContainer } from "@components/TooltipContainer";
import { classNameFactory } from "@utils/css";
import { Margins } from "@utils/margins";
import { classes } from "@utils/misc";
import { ModalCloseButton, ModalContent, ModalHeader, ModalProps, ModalRoot, ModalSize, openModal } from "@utils/modal";
import { findCssClassesLazy } from "@webpack";
import { Button, TabBar, Text, Timestamp, useState } from "@webpack/common";

import { parseEditContent } from ".";

const CodeContainerClasses = findCssClassesLazy("markup", "codeContainer");
const MiscClasses = findCssClassesLazy("messageContent", "markupRtl");

const cl = classNameFactory("vc-ml-modal-");

type DiffEntry = { type: "keep" | "add" | "remove"; text: string; };

/**
 * Computes a word-level LCS diff between two strings.
 * Returns an array of entries tagged as "keep", "add", or "remove".
 */
function computeWordDiff(prev: string, next: string): DiffEntry[] {
    // Split on whitespace boundaries, keeping the whitespace tokens so the output re-joins cleanly
    const prevWords = prev.split(/(\s+)/);
    const nextWords = next.split(/(\s+)/);
    const m = prevWords.length;
    const n = nextWords.length;

    // Build LCS table
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = prevWords[i - 1] === nextWords[j - 1]
                ? dp[i - 1][j - 1] + 1
                : Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
    }

    // Backtrack to build diff
    const result: DiffEntry[] = [];
    let i = m, j = n;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && prevWords[i - 1] === nextWords[j - 1]) {
            result.unshift({ type: "keep", text: prevWords[i - 1] });
            i--; j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            result.unshift({ type: "add", text: nextWords[j - 1] });
            j--;
        } else {
            result.unshift({ type: "remove", text: prevWords[i - 1] });
            i--;
        }
    }

    return result;
}

export function openHistoryModal(message: any) {
    openModal(props =>
        <ErrorBoundary>
            <HistoryModal
                modalProps={props}
                message={message}
            />
        </ErrorBoundary>
    );
}

export function HistoryModal({ modalProps, message }: { modalProps: ModalProps; message: any; }) {
    const [currentTab, setCurrentTab] = useState(message.editHistory.length);
    const [showDiff, setShowDiff] = useState(false);

    const timestamps = [message.firstEditTimestamp, ...message.editHistory.map((m: any) => m.timestamp)];
    const contents = [...message.editHistory.map((m: any) => m.content), message.content];

    const prevContent: string | null = currentTab > 0 ? contents[currentTab - 1] : null;
    const currContent: string = contents[currentTab];
    const diffEntries: DiffEntry[] | null = prevContent != null ? computeWordDiff(prevContent, currContent) : null;

    function handleTabSelect(tab: number) {
        setCurrentTab(tab);
        setShowDiff(false); // Reset diff view on tab change
    }

    return (
        <ModalRoot {...modalProps} size={ModalSize.LARGE}>
            <ModalHeader className={cl("head")}>
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>Message Edit History</Text>
                {diffEntries && (
                    <Button
                        size={Button.Sizes.SMALL}
                        look={showDiff ? Button.Looks.FILLED : Button.Looks.OUTLINED}
                        color={Button.Colors.BRAND}
                        onClick={() => setShowDiff(v => !v)}
                    >
                        {showDiff ? "Show Content" : "Show Diff"}
                    </Button>
                )}
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>

            <ModalContent className={cl("contents")}>
                <TabBar
                    type="top"
                    look="brand"
                    className={classes("vc-settings-tab-bar", cl("tab-bar"))}
                    selectedItem={currentTab}
                    onItemSelect={handleTabSelect}
                >
                    {message.firstEditTimestamp.getTime() !== message.timestamp.getTime() && (
                        <TooltipContainer text="This edit state was not logged so it can't be displayed.">
                            <TabBar.Item
                                className="vc-settings-tab-bar-item"
                                id={-1}
                                disabled
                            >
                                <Timestamp
                                    className={cl("timestamp")}
                                    timestamp={message.timestamp}
                                    isEdited={true}
                                    isInline={false}
                                />
                            </TabBar.Item>
                        </TooltipContainer>
                    )}

                    {timestamps.map((timestamp: any, index: number) => (
                        <TabBar.Item
                            key={index}
                            className="vc-settings-tab-bar-item"
                            id={index}
                        >
                            <Timestamp
                                className={cl("timestamp")}
                                timestamp={timestamp}
                                isEdited={true}
                                isInline={false}
                            />
                        </TabBar.Item>
                    ))}
                </TabBar>

                <div className={classes(CodeContainerClasses.markup, MiscClasses.messageContent, Margins.top20)}>
                    {showDiff && diffEntries
                        ? diffEntries.map((entry, idx) =>
                            entry.type === "keep"
                                ? <span key={idx}>{entry.text}</span>
                                : <span key={idx} className={cl(`diff-${entry.type}`)}>{entry.text}</span>
                        )
                        : parseEditContent(currContent, message)
                    }
                </div>
            </ModalContent>
        </ModalRoot>
    );
}