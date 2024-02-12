import {
	VSCodeTextArea,
	VSCodeTextField,
} from "@vscode/webview-ui-toolkit/react";
import { useRef } from "react";
import { FaPlay, FaStopCircle } from "react-icons/fa";
import styled from "styled-components";

const UserInput = styled.div`
	flex-basis: 50px;
	padding: 12px 0px;
	display: flex;
	flex-direction: row;
	align-items: center;
`;

interface ChatInputProps {
	onChatSubmitted: (input: string) => void;
	onChatCancelled: () => void;
	loading: boolean;
}

const ChatInput = ({
	loading,
	onChatSubmitted,
	onChatCancelled,
}: ChatInputProps) => {
	const chatInputBox = useRef<any>(null);

	const handleUserInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			if (e.shiftKey) {
				return;
			}

			const element = e.target as HTMLInputElement;
			const message = element.value;

			if (!message) {
				return;
			}

			e.preventDefault();

			onChatSubmitted(message);

			element.value = "";
		}
	};

	return (
		<UserInput>
			<VSCodeTextArea
				placeholder="Type here to chat with the extension"
				ref={chatInputBox}
				style={
					{
						width: "100%",
						"--input-height": "36",
					} as React.CSSProperties
				}
				onKeyDown={handleUserInput}
			/>
			<span style={{ padding: "1em" }}>
				{!loading && (
					<FaPlay
						size={16}
						role="presentation"
						title="Send message"
						onClick={() =>
							handleUserInput({
								key: "Enter",
								preventDefault: () => {},
								target: chatInputBox.current,
							} as unknown as React.KeyboardEvent<HTMLInputElement>)
						}
					/>
				)}
				{loading && (
					<FaStopCircle
						size={16}
						role="presentation"
						title="Cancel chat"
						onClick={onChatCancelled}
					/>
				)}
			</span>
		</UserInput>
	);
};

export { ChatInput };
