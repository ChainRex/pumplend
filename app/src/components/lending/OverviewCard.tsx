import { Box, Flex, Text, Button } from "@radix-ui/themes";
import { CircularProgressbarWithChildren } from 'react-circular-progressbar';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import 'react-circular-progressbar/dist/styles.css';

interface OverviewCardProps {
  title: string;
  value: number;
  apy?: number | null;
  percentage?: number;
  isHealthFactor?: boolean;
}

export function OverviewCard({ title, value, apy, percentage, isHealthFactor }: OverviewCardProps) {
  const isBorrow = title.toLowerCase().includes("borrow");
  const progressColor = isBorrow ? "rgb(255, 112, 112)" : "rgb(13, 195, 164)";
  const apyColor = isBorrow ? "red" : "green";
  const percentageTextColor = isBorrow ? "rgb(255, 112, 112)" : "white";

  return (
    <Box
      className="overview-card"
      style={{
        padding: '16px',
        borderRadius: '12px',
        backgroundColor: '#1a1a1a',
        width: '90%',
        minHeight: '160px',
        border: 'none',
        margin: '0 auto',
      }}
    >
      <Flex align="center" justify="between" gap="4">
        {percentage !== undefined && (
          <Box style={{ width: 100, height: 100 }}>
            <CircularProgressbarWithChildren
              value={percentage}
              strokeWidth={8}
              styles={{
                path: {
                  stroke: progressColor,
                  strokeLinecap: 'round',
                },
                trail: {
                  stroke: '#333',
                },
              }}
            >
              <Text size="3" style={{ color: percentageTextColor, marginBottom: '0', textAlign: 'center' }}>{percentage}%</Text>
              <Text size="1" style={{ color: '#888', textAlign: 'center', marginTop: '4px' }}>{title}</Text>
            </CircularProgressbarWithChildren>
          </Box>
        )}
        
        <Flex direction="column" style={{ flex: 1 }}>
          <Flex align="center" justify="between">
            <Text size="5" weight="bold" style={{ color: "white", marginBottom: '4px' }}>{title}</Text>
            {apy !== null && (
              <Text size="2" style={{ color: apyColor }}>
                APY: {apy}%
              </Text>
            )}
          </Flex>
          <Text size="7" weight="bold" style={{ color: 'white', marginBottom: '4px' }}>
            ${value.toLocaleString()}
          </Text>
        </Flex>

        {isHealthFactor}
      </Flex>
    </Box>
  );
}