import { Box, Flex, Text } from "@radix-ui/themes";

interface OverviewCardProps {
  title: string;
  value: string | number;
  isHealthFactor?: boolean;
}

export function OverviewCard({ title, value, isHealthFactor }: OverviewCardProps) {
  const getHealthFactorColor = (value: string | number): string => {
    const numValue = Number(value);
    if (numValue <= 1) return "rgb(255, 67, 67)"; // 红色
    if (numValue <= 2) return "rgb(255, 170, 0)"; // 黄色
    return "rgb(0, 200, 83)"; // 绿色
  };

  return (
    <Box
      className="overview-card"
      style={{
        padding: '16px',
        flex: 1,
        minWidth: '240px',
      }}
    >
      <Flex direction="column">
        <Flex align="center" justify="between">
          <Text size="5" weight="bold" style={{ color: "white", marginBottom: '4px' }}>{title}</Text>
        </Flex>
        <Text 
          size="7" 
          weight="bold" 
          style={{ 
            color: isHealthFactor ? getHealthFactorColor(value) : 'white',
            marginBottom: '4px' 
          }}
        >
          {value} {!isHealthFactor && 'SUI'}
        </Text>
      </Flex>
    </Box>
  );
}