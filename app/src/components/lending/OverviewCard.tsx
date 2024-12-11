import { Box, Flex, Text, Button } from "@radix-ui/themes";
import { CircularProgressbar } from 'react-circular-progressbar';

interface OverviewCardProps {
  title: string;
  value: number;
  apy?: number | null;
  percentage?: number;
  isHealthFactor?: boolean;
}

export function OverviewCard({ title, value, apy, percentage, isHealthFactor }: OverviewCardProps) {
  return (
    <Box className="overview-card">
      <Flex align="center" gap="4">
        {percentage !== undefined && (
          <Box style={{ width: 60, height: 60 }}>
            <CircularProgressbar
              value={percentage}
              text={`${percentage}%`}
              styles={{
                path: {
                  stroke: `rgba(62, 152, 199, ${percentage / 100})`,
                },
                text: {
                  fill: '#fff',
                  fontSize: '24px',
                },
              }}
            />
          </Box>
        )}
        <Box>
          <Text size="2" color="gray">{title}</Text>
          <Text size="6" weight="bold">${value}</Text>
          <Text size="2" color="gray">APY: {apy || '--'}%</Text>
        </Box>
        {isHealthFactor && (
          <Flex gap="2">
            <Button variant="soft" size="1">RISK DETAILS</Button>
            <Button variant="soft" size="1">NOTIFI</Button>
          </Flex>
        )}
      </Flex>
    </Box>
  );
} 