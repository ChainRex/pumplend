import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Flex, Text, Link } from '@radix-ui/themes';
import { ExternalLinkIcon } from '@radix-ui/react-icons';

export type ToastType = 'info' | 'error' | 'success';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
  txHash?: string;
  tokenUrl?: string;
}

export function Toast({ message, type, onClose, duration = 3000, txHash, tokenUrl }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  return createPortal(
    <Flex
      className={`toast ${type}`}
      direction="column"
      gap="2"
    >
      <Text size="2">{message}</Text>
      {txHash && (
        <Link
          href={`https://suiscan.xyz/testnet/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="toast-link"
        >
          <Flex align="center" gap="1">
            <Text size="1">View Transaction</Text>
            <ExternalLinkIcon />
          </Flex>
        </Link>
      )}
      {tokenUrl && (
        <Link
          href={tokenUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="toast-link"
        >
          <Flex align="center" gap="1">
            <Text size="1">View Token</Text>
            <ExternalLinkIcon />
          </Flex>
        </Link>
      )}
    </Flex>,
    document.body
  );
} 